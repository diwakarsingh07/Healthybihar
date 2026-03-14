import React, { useRef } from 'react';
import { X, Download, Printer, Heart, CheckCircle2, ShieldCheck } from 'lucide-react';
import html2canvas from 'html2canvas';

interface DonationReceiptProps {
  donorName: string;
  amount: number;
  transactionId: string;
  date: string;
  onClose: () => void;
}

const SLOGANS = [
  "Your kindness is the heartbeat of our community.",
  "Small contributions, big impact. Thank you for healing Arwal.",
  "A healthier Bihar starts with your generous support.",
  "Thank you for being a lifeline for those in need.",
  "Your donation today brings hope for a better tomorrow.",
  "Healing hands, helping hearts. We appreciate your support.",
  "Together, we are making healthcare accessible for all."
];

export default function DonationReceipt({ donorName, amount, transactionId, date, onClose }: DonationReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Select slogan based on transaction ID to keep it consistent for the same receipt
  const sloganIndex = parseInt(transactionId.slice(-1), 16) % SLOGANS.length;
  const slogan = SLOGANS[sloganIndex];

  const handleDownload = async () => {
    if (receiptRef.current) {
      try {
        // Add a temporary class to the receipt for better capture
        receiptRef.current.classList.add('is-capturing');
        
        // Wait a tiny bit for any layout shifts
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(receiptRef.current, {
          backgroundColor: '#ffffff',
          scale: 2, // High resolution
          useCORS: true, // Allow cross-origin images
          logging: false,
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        
        receiptRef.current.classList.remove('is-capturing');

        const link = document.createElement('a');
        link.download = `AHN-Receipt-${transactionId}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        receiptRef.current?.classList.remove('is-capturing');
        console.error('Error generating receipt image:', error);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <style>{`
        .is-capturing {
          box-shadow: none !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 0 !important;
        }
        .is-capturing * {
          text-shadow: none !important;
          box-shadow: none !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-to-print, #receipt-to-print * {
            visibility: visible;
          }
          #receipt-to-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Actions */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Donation Receipt
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownload}
              className="p-2 text-slate-600 hover:bg-white hover:text-emerald-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Download as Image"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:bg-white hover:text-emerald-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div 
            ref={receiptRef}
            id="receipt-to-print"
            className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"
            style={{ minHeight: '600px', width: '500px', margin: '0 auto', backgroundColor: '#ffffff' }}
          >
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-30deg]">
              <Heart className="w-96 h-96 fill-emerald-600" />
            </div>

            {/* Logo Section */}
            <div className="flex flex-col items-center text-center mb-10 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-2 w-full">
                <div className="shrink-0">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 20H12L16 8L24 32L28 20H36" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-2xl font-black text-[#059669] tracking-tight whitespace-nowrap">Healthy Bihar</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Arwal Health Network</p>
            </div>

            {/* Receipt Body */}
            <div className="space-y-8 relative z-10">
              <div className="text-center">
                <h2 className="text-3xl font-serif italic text-slate-800 mb-2">Thank You, {donorName}!</h2>
                <p className="text-emerald-600 font-medium text-sm">{slogan}</p>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Receipt Number</p>
                  <p className="text-sm font-mono text-slate-700">#AHN-{transactionId.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
                  <p className="text-sm text-slate-700">{date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                  <p className="text-sm text-slate-700">UPI Transfer</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contribution Amount</p>
                  <p className="text-slate-600 text-xs">Healthcare Support Fund</p>
                </div>
                <p className="text-3xl font-black text-slate-900">₹{amount}</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  This receipt acknowledges your generous donation to the Arwal Health Network. 
                  Your support directly contributes to improving medical facilities and accessibility 
                  in the Arwal district of Bihar.
                </p>
              </div>

              <div className="pt-10 flex justify-between items-end">
                <div className="text-center">
                  <div className="w-32 h-px bg-slate-300 mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Donor Signature</p>
                </div>
                <div className="text-center">
                  <div className="mb-2">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=https://arwal-health.network/verify" 
                      alt="Verify" 
                      crossOrigin="anonymous"
                      className="w-12 h-12 mx-auto opacity-50"
                    />
                  </div>
                  <div className="w-32 h-px bg-slate-300 mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Seal</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center relative z-10">
              <p className="text-[9px] text-slate-400 font-medium">
                Arwal Health Network is a student-led innovation project.<br/>
                Digital Receipt | Generated on {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Action */}
        <div className="p-6 bg-white border-top border-slate-100 shrink-0">
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
