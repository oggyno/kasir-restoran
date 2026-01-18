// ===========================================
// KONFIGURASI KEAMANAN
// ===========================================

// GANTI URL INI DENGAN URL GOOGLE APPS SCRIPT ANDA
const CONFIG = {
    SHEET_URL: 'https://script.google.com/macros/s/AKfycbz3ZstscYP5tMdaAmIGZqh1p9Ky7RiHiFfNryyJx1pKhM_LP5swP7rISHsg6y4Wehkf1g/exec',
    MAX_RETRIES: 3,
    TIMEOUT: 10000, // 10 detik
    CACHE_DURATION: 60000 // 1 menit
};

// Validasi input untuk mencegah XSS
const sanitizeInput = (input) => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
};

// Validasi angka
const isValidNumber = (value, min = 0) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= min;
};

// ===========================================
// PENGELOLAAN STATE
// ===========================================

let currentCache = {
    pemasukan: null,
    pengeluaran: null,
    timestamp: null
};

// ===========================================
// UTILITAS WAKTU
// ===========================================

const getDateTime = () => {
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
    const tanggal = now.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    return { jam, tanggal };
};

// ===========================================
// ALERT SYSTEM
// ===========================================

const showAlert = (message, isError = false) => {
    const alert = document.getElementById('alert');
    alert.textContent = sanitizeInput(message);
    alert.className = 'alert' + (isError ? ' error' : '');
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 3000);
};

// ===========================================
// TAB NAVIGATION
// ===========================================

const initTabs = () => {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
};

const switchTab = (tabName) => {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.content-tab').forEach(c => c.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Load data jika tab rekap
    if (tabName === 'rekap') {
        muatRekap();
    }
};

// ===========================================
// API COMMUNICATION dengan RETRY & TIMEOUT
// ===========================================

const fetchWithTimeout = async (url, options = {}, timeout = CONFIG.TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - koneksi terlalu lambat');
        }
        throw error;
    }
};

const sendDataWithRetry = async (data, retries = CONFIG.MAX_RETRIES) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetchWithTimeout(CONFIG.SHEET_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                throw error;
            }
            // Wait sebelum retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
};

const fetchDataWithRetry = async (type, tanggal, retries = CONFIG.MAX_RETRIES) => {
    for (let i = 0; i < retries; i++) {
        try {
            const url = `${CONFIG.SHEET_URL}?type=${encodeURIComponent(type)}&tanggal=${encodeURIComponent(tanggal)}`;
            const response = await fetchWithTimeout(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Fetch attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
};

// ===========================================
// FORM PEMASUKAN
// ===========================================

const initFormPemasukan = () => {
    const form = document.getElementById('formPemasukan');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const menuValue = document.getElementById('menuMakanan').value;
        const qty = document.getElementById('quantity').value;
        const metode = document.getElementById('metode').value;

        // Validasi
        if (!menuValue) {
            showAlert('Pilih menu terlebih dahulu!', true);
            return;
        }

        if (!isValidNumber(qty, 1)) {
            showAlert('Quantity harus minimal 1!', true);
            return;
        }

        // Parse menu
        const [nama, hargaStr] = menuValue.split('|');
        const harga = parseInt(hargaStr);
        const qtyNum = parseInt(qty);
        const total = harga * qtyNum;

        const { jam, tanggal } = getDateTime();

        const data = {
            type: 'pemasukan',
            jam: sanitizeInput(jam),
            tanggal: sanitizeInput(tanggal),
            nama: sanitizeInput(nama),
            harga: harga,
            qty: qtyNum,
            total: total,
            metode: sanitizeInput(metode)
        };

        // Disable button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await sendDataWithRetry(data);
            showAlert('✅ Pemasukan berhasil disimpan!');
            
            // Reset form
            form.reset();
            document.getElementById('quantity').value = '1';
            
            // Clear cache
            currentCache.pemasukan = null;
        } catch (error) {
            console.error('Error:', error);
            showAlert('❌ Gagal menyimpan. Periksa koneksi atau URL Apps Script.', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💰 Simpan Pemasukan';
        }
    });
};

// ===========================================
// FORM PENGELUARAN
// ===========================================

const initFormPengeluaran = () => {
    const form = document.getElementById('formPengeluaran');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const harga = document.getElementById('hargaPengeluaran').value;
        const keterangan = document.getElementById('keteranganPengeluaran').value.trim();

        // Validasi
        if (!isValidNumber(harga, 1)) {
            showAlert('Masukkan harga pengeluaran yang valid!', true);
            return;
        }

        if (!keterangan || keterangan.length < 3) {
            showAlert('Keterangan minimal 3 karakter!', true);
            return;
        }

        if (keterangan.length > 200) {
            showAlert('Keterangan maksimal 200 karakter!', true);
            return;
        }

        const { jam, tanggal } = getDateTime();

        const data = {
            type: 'pengeluaran',
            jam: sanitizeInput(jam),
            tanggal: sanitizeInput(tanggal),
            harga: parseInt(harga),
            keterangan: sanitizeInput(keterangan)
        };

        // Disable button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await sendDataWithRetry(data);
            showAlert('✅ Pengeluaran berhasil disimpan!');
            
            // Reset form
            form.reset();
            
            // Clear cache
            currentCache.pengeluaran = null;
        } catch (error) {
            console.error('Error:', error);
            showAlert('❌ Gagal menyimpan. Periksa koneksi atau URL Apps Script.', true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💸 Simpan Pengeluaran';
        }
    });
};

// ===========================================
// FORMAT CURRENCY
// ===========================================

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
};

// ===========================================
// LOAD REKAP DATA
// ===========================================

const muatRekap = async () => {
    const { tanggal } = getDateTime();
    
    // Check cache
    const now = Date.now();
    if (currentCache.timestamp && (now - currentCache.timestamp) < CONFIG.CACHE_DURATION) {
        renderRekap(currentCache.pemasukan, currentCache.pengeluaran);
        return;
    }

    const btnRefresh = document.getElementById('btnRefresh');
    btnRefresh.disabled = true;
    btnRefresh.textContent = '⏳ Loading...';

    try {
        // Parallel fetch untuk performa
        const [dataPemasukan, dataPengeluaran] = await Promise.all([
            fetchDataWithRetry('pemasukan', tanggal),
            fetchDataWithRetry('pengeluaran', tanggal)
        ]);

        // Update cache
        currentCache = {
            pemasukan: dataPemasukan,
            pengeluaran: dataPengeluaran,
            timestamp: Date.now()
        };

        renderRekap(dataPemasukan, dataPengeluaran);
        showAlert('✅ Data berhasil dimuat!');
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Gagal memuat data. ' + error.message, true);
    } finally {
        btnRefresh.disabled = false;
        btnRefresh.textContent = '🔄 Refresh Data';
    }
};

const renderRekap = (dataPemasukan, dataPengeluaran) => {
    // Render Tabel Pemasukan
    const tbody1 = document.getElementById('tabelPemasukan');
    tbody1.innerHTML = '';
    
    let totalPemasukan = 0;
    
    if (dataPemasukan && dataPemasukan.length > 0) {
        dataPemasukan.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sanitizeInput(String(row[0]))}</td>
                <td>${sanitizeInput(String(row[1]))}</td>
                <td>${sanitizeInput(String(row[2]))}</td>
                <td>${formatRupiah(row[3])}</td>
                <td>${sanitizeInput(String(row[4]))}</td>
                <td>${formatRupiah(row[5])}</td>
                <td>${sanitizeInput(String(row[6]))}</td>
            `;
            tbody1.appendChild(tr);
            totalPemasukan += Number(row[5]) || 0;
        });
    } else {
        tbody1.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data</td></tr>';
    }

    // Render Tabel Pengeluaran
    const tbody2 = document.getElementById('tabelPengeluaran');
    tbody2.innerHTML = '';
    
    let totalPengeluaran = 0;
    
    if (dataPengeluaran && dataPengeluaran.length > 0) {
        dataPengeluaran.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sanitizeInput(String(row[0]))}</td>
                <td>${sanitizeInput(String(row[1]))}</td>
                <td>${formatRupiah(row[2])}</td>
                <td>${sanitizeInput(String(row[3]))}</td>
            `;
            tbody2.appendChild(tr);
            totalPengeluaran += Number(row[2]) || 0;
        });
    } else {
        tbody2.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada data</td></tr>';
    }

    // Update Summary
    const saldoBersih = totalPemasukan - totalPengeluaran;
    
    document.getElementById('totalPemasukan').textContent = formatRupiah(totalPemasukan);
    document.getElementById('totalPengeluaran').textContent = formatRupiah(totalPengeluaran);
    document.getElementById('saldoBersih').textContent = formatRupiah(saldoBersih);
    
    // Update warna saldo (merah jika minus)
    const saldoElement = document.getElementById('saldoBersih');
    if (saldoBersih < 0) {
        saldoElement.style.color = '#ff6b6b';
    } else {
        saldoElement.style.color = '#c0c0c0';
    }
};

// ===========================================
// INITIALIZATION
// ===========================================

const checkConfig = () => {
    if (CONFIG.SHEET_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') {
        showAlert('⚠️ Mohon setup Google Apps Script URL terlebih dahulu!', true);
        return false;
    }
    return true;
};

// Init saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    checkConfig();
    initTabs();
    initFormPemasukan();
    initFormPengeluaran();
    
    // Event listener untuk refresh button
    document.getElementById('btnRefresh').addEventListener('click', muatRekap);
    
    console.log('✅ Sistem Kasir siap digunakan');
});