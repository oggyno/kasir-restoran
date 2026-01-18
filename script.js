// ===========================================
// KONFIGURASI
// ===========================================

const CONFIG = {
    SHEET_URL: 'https://script.google.com/macros/s/AKfycbytl0A7JZQl8iKR0_Y1SGx-bZqScj4eMArK1E_DoCupOKCd_8hTZYh7h690RJtMFSAbew/exec', // Ganti dengan URL baru!
    MAX_RETRIES: 3,
    TIMEOUT: 10000,
    CACHE_DURATION: 60000
};

// Validasi input
const sanitizeInput = (input) => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
};

const isValidNumber = (value, min = 0) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= min;
};

// ===========================================
// STATE MANAGEMENT
// ===========================================

let currentCache = {
    pemasukan: null,
    pengeluaran: null,
    timestamp: null
};

// ===========================================
// UTILITIES
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

const showAlert = (message, isError = false) => {
    const alert = document.getElementById('alert');
    alert.textContent = sanitizeInput(message);
    alert.className = 'alert' + (isError ? ' error' : '');
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 3000);
};

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
};

// ===========================================
// API CALLS - Sekarang Pakai GET Semua!
// ===========================================

const saveData = async (data) => {
    const params = new URLSearchParams({
        action: 'save',
        ...data
    });
    
    const url = `${CONFIG.SHEET_URL}?${params.toString()}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
};

const fetchData = async (type, tanggal) => {
    const params = new URLSearchParams({
        action: 'fetch',
        type: type,
        tanggal: tanggal
    });
    
    const url = `${CONFIG.SHEET_URL}?${params.toString()}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
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
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.content-tab').forEach(c => c.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'rekap') {
        muatRekap();
    }
};

// ===========================================
// FORM HANDLERS
// ===========================================

const initFormPemasukan = () => {
    const form = document.getElementById('formPemasukan');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const menuValue = document.getElementById('menuMakanan').value;
        const qty = document.getElementById('quantity').value;
        const metode = document.getElementById('metode').value;

        if (!menuValue) {
            showAlert('Pilih menu terlebih dahulu!', true);
            return;
        }

        if (!isValidNumber(qty, 1)) {
            showAlert('Quantity harus minimal 1!', true);
            return;
        }

        const [nama, hargaStr] = menuValue.split('|');
        const harga = parseInt(hargaStr);
        const qtyNum = parseInt(qty);
        const total = harga * qtyNum;

        const { jam, tanggal } = getDateTime();

        const data = {
            type: 'pemasukan',
            jam: jam,
            tanggal: tanggal,
            nama: nama,
            harga: harga,
            qty: qtyNum,
            total: total,
            metode: metode
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await saveData(data);
            showAlert('✅ Pemasukan berhasil disimpan!');
            form.reset();
            document.getElementById('quantity').value = '1';
            currentCache.pemasukan = null;
        } catch (error) {
            console.error('Error:', error);
            showAlert('❌ Gagal menyimpan: ' + error.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💰 Simpan Pemasukan';
        }
    });
};

const initFormPengeluaran = () => {
    const form = document.getElementById('formPengeluaran');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const harga = document.getElementById('hargaPengeluaran').value;
        const keterangan = document.getElementById('keteranganPengeluaran').value.trim();

        if (!isValidNumber(harga, 1)) {
            showAlert('Masukkan harga pengeluaran yang valid!', true);
            return;
        }

        if (!keterangan || keterangan.length < 3) {
            showAlert('Keterangan minimal 3 karakter!', true);
            return;
        }

        const { jam, tanggal } = getDateTime();

        const data = {
            type: 'pengeluaran',
            jam: jam,
            tanggal: tanggal,
            harga: parseInt(harga),
            keterangan: keterangan
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await saveData(data);
            showAlert('✅ Pengeluaran berhasil disimpan!');
            form.reset();
            currentCache.pengeluaran = null;
        } catch (error) {
            console.error('Error:', error);
            showAlert('❌ Gagal menyimpan: ' + error.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💸 Simpan Pengeluaran';
        }
    });
};

// ===========================================
// REKAP DATA
// ===========================================

const muatRekap = async () => {
    const { tanggal } = getDateTime();
    
    const now = Date.now();
    if (currentCache.timestamp && (now - currentCache.timestamp) < CONFIG.CACHE_DURATION) {
        renderRekap(currentCache.pemasukan, currentCache.pengeluaran);
        return;
    }

    const btnRefresh = document.getElementById('btnRefresh');
    btnRefresh.disabled = true;
    btnRefresh.textContent = '⏳ Loading...';

    try {
        const [dataPemasukan, dataPengeluaran] = await Promise.all([
            fetchData('pemasukan', tanggal),
            fetchData('pengeluaran', tanggal)
        ]);

        currentCache = {
            pemasukan: dataPemasukan,
            pengeluaran: dataPengeluaran,
            timestamp: Date.now()
        };

        renderRekap(dataPemasukan, dataPengeluaran);
        showAlert('✅ Data berhasil dimuat!');
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Gagal memuat data: ' + error.message, true);
    } finally {
        btnRefresh.disabled = false;
        btnRefresh.textContent = '🔄 Refresh Data';
    }
};

const renderRekap = (dataPemasukan, dataPengeluaran) => {
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

    const saldoBersih = totalPemasukan - totalPengeluaran;
    
    document.getElementById('totalPemasukan').textContent = formatRupiah(totalPemasukan);
    document.getElementById('totalPengeluaran').textContent = formatRupiah(totalPengeluaran);
    document.getElementById('saldoBersih').textContent = formatRupiah(saldoBersih);
    
    const saldoElement = document.getElementById('saldoBersih');
    saldoElement.style.color = saldoBersih < 0 ? '#ff6b6b' : '#c0c0c0';
};

// ===========================================
// INITIALIZATION
// ===========================================

const checkConfig = () => {
    if (CONFIG.SHEET_URL === 'PASTE_URL_APPS_SCRIPT_BARU_DISINI') {
        showAlert('⚠️ Mohon setup Google Apps Script URL terlebih dahulu!', true);
        return false;
    }
    return true;
};

document.addEventListener('DOMContentLoaded', () => {
    checkConfig();
    initTabs();
    initFormPemasukan();
    initFormPengeluaran();
    document.getElementById('btnRefresh').addEventListener('click', muatRekap);
    console.log('✅ Sistem Kasir siap digunakan');
});
