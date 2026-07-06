import React, { useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Printer, Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';

// Helper to convert number to words (Indian Rupee format)
const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : '';
  return str.trim() || 'Zero Only';
};

const PrintableVoucher = ({ data, onClose }) => {
  const printRef = useRef(null);

  const formatCurrency = (val) => {
    return parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Use a simpler print approach using an iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const pri = iframe.contentWindow;
    pri.document.open();
    pri.document.write(`
      <html>
        <head>
          <title>Print Voucher</title>
          <style>
             body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; color: #000; }
             * { box-sizing: border-box; }
             .voucher-container { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 30px; }
             .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
             .header h1 { margin: 0 0 5px 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
             .header p { margin: 0; font-size: 14px; color: #555; }
             .row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; }
             .field-label { font-weight: bold; width: 140px; display: inline-block; }
             .field-value { border-bottom: 1px dashed #999; flex-grow: 1; margin-left: 10px; padding-left: 5px; }
             .amount-box { border: 2px solid #333; font-weight: bold; font-size: 18px; padding: 10px; text-align: center; width: 200px; margin-top: 20px; }
             .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
             .sig-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          \${printContent.innerHTML}
        </body>
      </html>
    `);
    pri.document.close();
    
    // Remove iframe after printing
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 1000);
  };

  const handleDownload = async () => {
    if (!printRef.current) return;
    try {
      // Create a temporary clone for downloading so we can remove shadows and fix styles
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Voucher_${data.voucherNo || 'Doc'}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    }
  };

  const amountWords = data.amountWords === true ? numberToWords(Math.floor(data.amount)) : (data.amountWords || numberToWords(Math.floor(data.amount)));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 shadow-sm">
         <h2 className="text-lg font-semibold text-slate-800">Payment Voucher</h2>
         <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
               <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="default" size="sm" onClick={handleDownload} className="gap-2 bg-slate-900">
               <Download className="w-4 h-4" /> Download
            </Button>
            {onClose && (
               <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
                  <X className="w-5 h-5 text-slate-500" />
               </Button>
            )}
         </div>
      </div>

      {/* Printable Area - Designed carefully to translate well to print */}
      <div className="p-8 flex-grow overflow-auto flex justify-center bg-slate-100">
         <div 
           ref={printRef} 
           className="bg-white p-10 shadow-lg"
           style={{ width: '800px', minHeight: '600px' }}
         >
            {/* Voucher Structure using inline styles for perfect HTML export */}
            <div className="voucher-container" style={{ border: '2px solid #1e293b', padding: '40px' }}>
               
               <div className="header" style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '20px', marginBottom: '30px' }}>
                  <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', textTransform: 'uppercase', color: '#0f172a' }}>
                     PAYMENT VOUCHER
                  </h1>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
                     {data.type || 'FIRM PAYMENT'}
                  </p>
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', fontSize: '15px' }}>
                  <div>
                     <span style={{ fontWeight: 'bold', color: '#334155' }}>Voucher No:</span> 
                     <span style={{ marginLeft: '10px', fontWeight: '600' }}>{data.voucherNo}</span>
                  </div>
                  <div>
                     <span style={{ fontWeight: 'bold', color: '#334155' }}>Date:</span> 
                     <span style={{ marginLeft: '10px', fontWeight: '600' }}>{formatDate(data.date)}</span>
                  </div>
               </div>

               <div style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                     <span style={{ fontWeight: 'bold', width: '130px', color: '#334155' }}>Paid To:</span>
                     <span style={{ flexGrow: 1, borderBottom: '1px dashed #cbd5e1', paddingLeft: '10px', fontWeight: '600' }}>
                        {data.receiverName}
                     </span>
                  </div>

                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                     <span style={{ fontWeight: 'bold', width: '130px', color: '#334155' }}>The Sum of Rs:</span>
                     <span style={{ flexGrow: 1, borderBottom: '1px dashed #cbd5e1', paddingLeft: '10px', fontStyle: 'italic', fontWeight: '500' }}>
                        {amountWords}
                     </span>
                  </div>

                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                     <span style={{ fontWeight: 'bold', width: '130px', color: '#334155' }}>By Means Of:</span>
                     <span style={{ flexGrow: 1, borderBottom: '1px dashed #cbd5e1', paddingLeft: '10px', fontWeight: '500' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '10px' }}>{data.paymentMode}</span> 
                        {data.bankDetails && `(${data.bankDetails})`}
                     </span>
                  </div>

                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                     <span style={{ fontWeight: 'bold', width: '130px', color: '#334155' }}>On Account Of:</span>
                     <span style={{ flexGrow: 1, borderBottom: '1px dashed #cbd5e1', paddingLeft: '10px', minHeight: '30px', fontWeight: '500' }}>
                        {data.remarks}
                     </span>
                  </div>
               </div>

               <div style={{ marginTop: '30px', border: '2px solid #1e293b', display: 'inline-block', padding: '10px 30px', fontSize: '20px', fontWeight: 'bold', color: '#0f172a', backgroundColor: '#f8fafc' }}>
                  ₹ {formatCurrency(data.amount)} /-
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '100px' }}>
                  <div style={{ width: '220px', borderTop: '1px solid #334155', textAlign: 'center', paddingTop: '10px', fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                     Authorized By<br />
                     <span style={{ fontSize: '12px', fontWeight: 'normal' }}>{data.authorizedBy || '................................'}</span>
                  </div>
                  <div style={{ width: '220px', borderTop: '1px solid #334155', textAlign: 'center', paddingTop: '10px', fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                     Receiver's Signature<br />
                     <span style={{ fontSize: '12px', fontWeight: 'normal' }}>{data.receivedBy || '................................'}</span>
                  </div>
               </div>

            </div>
         </div>
      </div>
    </div>
  );
};

export default PrintableVoucher;
