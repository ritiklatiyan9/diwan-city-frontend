import * as XLSX from 'xlsx';

/**
 * Converts FortuneSheet data array into an actual .xlsx File object
 * @param {Array} sheets - FortuneSheet data array
 * @param {string} fileName - Current file name
 * @returns {File} - .xlsx File object ready for FormData upload
 */
export const exportFortuneSheetToXLSXFile = (sheets, fileName) => {
    const wb = XLSX.utils.book_new();

    sheets.forEach((sheet) => {
        const sheetName = sheet.name || 'Sheet1';

        // Ensure data exists
        if (!sheet.data || sheet.data.length === 0) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), sheetName);
            return;
        }

        // Convert the complex FortuneSheet data array back to a simple 2D array of values
        const aoa = sheet.data.map(row => {
            if (!row) return [];
            return row.map(cell => {
                if (!cell) return null;
                // v is the actual value. If it has m (display text), we could use it, but v is raw
                return cell.v !== undefined ? cell.v : cell.m !== undefined ? cell.m : null;
            });
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Optional: you can extract merges from sheet.config.merge
        if (sheet.config && sheet.config.merge) {
            const merges = [];
            for (const key in sheet.config.merge) {
                const m = sheet.config.merge[key];
                merges.push({
                    s: { r: m.r, c: m.c },
                    e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 }
                });
            }
            if (merges.length > 0) ws['!merges'] = merges;
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Generate ArrayBuffer and convert to Blob -> File
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    return new File([blob], `${fileName}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
