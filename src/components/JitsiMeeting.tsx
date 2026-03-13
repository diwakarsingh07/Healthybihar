import React, { useEffect, useRef } from 'react';

interface JitsiMeetingProps {
  roomName: string;
  displayName?: string;
  onClose?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiMeeting: React.FC<JitsiMeetingProps> = ({ roomName, displayName, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://8x8.vc/vpaas-magic-cookie-1710b053d7e04490a8815a76bbe4ee2d/external_api.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && window.JitsiMeetExternalAPI) {
        // The room name should probably include the magic cookie prefix if using 8x8.vc
        const fullRoomName = `vpaas-magic-cookie-1710b053d7e04490a8815a76bbe4ee2d/${roomName}`;
        
        apiRef.current = new window.JitsiMeetExternalAPI("8x8.vc", {
          roomName: fullRoomName,
          parentNode: containerRef.current,
          userInfo: {
            displayName: displayName || 'User'
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            // Add any interface customizations here
          }
        });

        apiRef.current.addEventListener('readyToClose', () => {
          if (onClose) onClose();
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      document.body.removeChild(script);
    };
  }, [roomName, displayName, onClose]);

  return (
    <div className="w-full h-full min-h-[500px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
      <div ref={containerRef} className="w-full h-full" />
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
        title="Close Meeting"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default JitsiMeeting;
