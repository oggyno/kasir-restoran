// ===========================================
// KONFIGURASI
// ===========================================

const CONFIG = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyFj-WOvMCPmyd2WvewOIV-Vy8gH2qzJh9_vu7Ohp3XlCiHnQVqtwL1otpnBj3Mjq-Bhg/exec'
};

// ===========================================
// UTILITIES
// ===========================================

const sanitizeInput = (input) => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
};

const isValidNumber = (value, min = 0) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= min;
};

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
// FORM SUBMISSION - NO CORS!
// ===========================================

const submitFormData = (data) => {
    return new Promise((resolve, reject) => {
        // Create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.name = 'hidden_iframe_' + Date.now();
        document.body.appendChild(iframe);

        // Create form
        const form = document.createElement('form');
        form.action = CONFIG.APPS_SCRIPT_URL;
        form.method = 'POST';
        form.target = iframe.name;

        // Add form fields
        Object.keys(data).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);

        // Handle response
        iframe.onload = () => {
            setTimeout(() => {
                document.body.removeChild(form);
                document.body.removeChild(iframe);
                resolve({ status: 'success' });
            }, 1000);
        };

        // Submit form
        form.submit();
    });
};

const fetchData = async (type, tanggal) => {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=fetch&type=${type}&tanggal=${encodeURIComponent(tanggal)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch data');
    }
    return await response.json();
};

// ===========================================
// UI HANDLERS
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
            action: 'save',
            type: 'pemasukan',
            jam, tanggal, nama,
            harga, qty: qtyNum, total, metode
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await submitFormData(data);
            showAlert('✅ Pemasukan berhasil disimpan!');
            form.reset();
            document.getElementById('quantity').value = '1';
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
            action: 'save',
            type: 'pengeluaran',
            jam, tanggal,
            harga: parseInt(harga),
            keterangan
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await submitFormData(data);
            showAlert('✅ Pengeluaran berhasil disimpan!');
            form.reset();
        } catch (error) {
            console.error('Error:', error);
            showAlert('❌ Gagal menyimpan: ' + error.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💸 Simpan Pengeluaran';
        }
    });
};

const muatRekap = async () => {
    const { tanggal } = getDateTime();

    const btnRefresh = document.getElementById('btnRefresh');
    btnRefresh.disabled = true;
    btnRefresh.textContent = '⏳ Loading...';

    try {
        const [dataPemasukan, dataPengeluaran] = await Promise.all([
            fetchData('pemasukan', tanggal),
            fetchData('pengeluaran', tanggal)
        ]);

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
                <td>${sanitizeInput(String(row[0] || ''))}</td>
                <td>${sanitizeInput(String(row[1] || ''))}</td>
                <td>${sanitizeInput(String(row[2] || ''))}</td>
                <td>${formatRupiah(Number(row[3]) || 0)}</td>
                <td>${sanitizeInput(String(row[4] || ''))}</td>
                <td>${formatRupiah(Number(row[5]) || 0)}</td>
                <td>${sanitizeInput(String(row[6] || ''))}</td>
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
                <td>${sanitizeInput(String(row[0] || ''))}</td>
                <td>${sanitizeInput(String(row[1] || ''))}</td>
                <td>${formatRupiah(Number(row[2]) || 0)}</td>
                <td>${sanitizeInput(String(row[3] || ''))}</td>
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

document.addEventListener('DOMContentLoaded', () => {
    if (!CONFIG.APPS_SCRIPT_URL.includes('PASTE')) {
        initTabs();
        initFormPemasukan();
        initFormPengeluaran();
        document.getElementById('btnRefresh').addEventListener('click', muatRekap);
        console.log('✅ Sistem Kasir - Form Submission Method (NO CORS!)');
    } else {
        showAlert('⚠️ Setup Apps Script URL!', true);
    }
});
