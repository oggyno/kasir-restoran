// ===========================================
// KONFIGURASI - GANTI INI!
// ===========================================

const CONFIG = {
    API_KEY: 'AIzaSyDkRN-c4Fw2IzY2jru2PvcfP9hTHalSHwI',
    SPREADSHEET_ID: '18FvSrYzmIgOcyIIDiS0EBIPzFMAU69kx3aQnRXFOJIU',
    SHEET_PEMASUKAN: 'Pemasukan',
    SHEET_PENGELUARAN: 'Pengeluaran'
};

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

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
// GOOGLE SHEETS API CALLS
// ===========================================

const appendToSheet = async (sheetName, values) => {
    const url = `${SHEETS_API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${sheetName}:append?valueInputOption=RAW&key=${CONFIG.API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            values: [values]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error.message || 'Failed to save data');
    }

    return await response.json();
};

const getSheetData = async (sheetName) => {
    const url = `${SHEETS_API_BASE}/${CONFIG.SPREADSHEET_ID}/values/${sheetName}?key=${CONFIG.API_KEY}`;
    
    const response = await fetch(url, {
        method: 'GET'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error.message || 'Failed to fetch data');
    }

    const data = await response.json();
    return data.values || [];
};

// ===========================================
// BUSINESS LOGIC
// ===========================================

const savePemasukan = async (data) => {
    const row = [
        data.jam,
        data.tanggal,
        data.nama,
        data.harga,
        data.qty,
        data.total,
        data.metode
    ];
    
    await appendToSheet(CONFIG.SHEET_PEMASUKAN, row);
};

const savePengeluaran = async (data) => {
    const row = [
        data.jam,
        data.tanggal,
        data.harga,
        data.keterangan
    ];
    
    await appendToSheet(CONFIG.SHEET_PENGELUARAN, row);
};

const getPemasukan = async (tanggal) => {
    const data = await getSheetData(CONFIG.SHEET_PEMASUKAN);
    // Skip header (row 0) and filter by date
    return data.slice(1).filter(row => row[1] === tanggal);
};

const getPengeluaran = async (tanggal) => {
    const data = await getSheetData(CONFIG.SHEET_PENGELUARAN);
    // Skip header (row 0) and filter by date
    return data.slice(1).filter(row => row[1] === tanggal);
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
            jam, tanggal, nama, harga,
            qty: qtyNum, total, metode
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await savePemasukan(data);
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
            jam, tanggal,
            harga: parseInt(harga),
            keterangan
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Menyimpan...';

        try {
            await savePengeluaran(data);
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
            getPemasukan(tanggal),
            getPengeluaran(tanggal)
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
    if (!CONFIG.API_KEY.includes('PASTE')) {
        initTabs();
        initFormPemasukan();
        initFormPengeluaran();
        document.getElementById('btnRefresh').addEventListener('click', muatRekap);
        console.log('✅ Sistem Kasir siap - Google Sheets API (NO CORS!)');
    } else {
        showAlert('⚠️ Setup API Key & Spreadsheet ID terlebih dahulu!', true);
    }
});
