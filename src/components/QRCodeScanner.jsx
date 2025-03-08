import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import '../styles/qrcode.css';

const QRCodeScanner = ({ onScan, scanDelay = 500 }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);
  
  useEffect(() => {
    // Initialize scanner
    const initScanner = async () => {
      try {
        // Check camera permissions
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop tracks after permission check
        setPermission(true);
        
        // Create scanner instance
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerInstanceRef.current = html5QrCode;
        
        // Start scanning
        startScanner();
      } catch (err) {
        setError('Camera permission denied. Please allow camera access to scan QR codes.');
        setPermission(false);
        console.error('QR Scanner initialization error:', err);
      }
    };
    
    initScanner();
    
    // Cleanup
    return () => {
      stopScanner();
    };
  }, []);
  
  const startScanner = async () => {
    if (!scannerInstanceRef.current || isScanning) return;
    
    try {
      setIsScanning(true);
      setError('');
      
      const qrCodeSuccessCallback = (decodedText) => {
        // Call the onScan callback with the decoded text
        if (onScan && typeof onScan === 'function') {
          onScan(decodedText);
        }
        
        // Optional: Stop scanning after successful scan
        // stopScanner();
      };
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [ Html5Qrcode.QR_CODE ]
      };
      
      await scannerInstanceRef.current.start(
        { facingMode: 'environment' },
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // This callback will be called continuously while scanning
          // Only log real errors, not "QR code not found" type messages
          if (errorMessage.includes('Unable to start scanning')) {
            setError(errorMessage);
            console.error('QR Scanning error:', errorMessage);
          }
        }
      );
    } catch (err) {
      setError('Failed to start camera. Please check camera permissions.');
      setIsScanning(false);
      console.error('QR Scanner start error:', err);
    }
  };
  
  const stopScanner = async () => {
    if (scannerInstanceRef.current && isScanning) {
      try {
        await scannerInstanceRef.current.stop();
      } catch (err) {
        console.error('QR Scanner stop error:', err);
      } finally {
        setIsScanning(false);
      }
    }
  };
  
  return (
    <div className="qr-scanner">
      {error && (
        <div className="scanner-error">{error}</div>
      )}
      
      <div 
        id="qr-reader" 
        ref={scannerRef}
        className={`scanner-container ${isScanning ? 'active' : ''}`}
      >
        {!permission && (
          <div className="permission-overlay">
            <p>Camera access is required to scan QR codes</p>
            <button 
              onClick={startScanner}
              className="permission-button"
            >
              Grant Camera Access
            </button>
          </div>
        )}
        
        <div className="scanner-frame">
          <div className="scanner-corner top-left"></div>
          <div className="scanner-corner top-right"></div>
          <div className="scanner-corner bottom-left"></div>
          <div className="scanner-corner bottom-right"></div>
        </div>
      </div>
      
      <div className="scanner-actions">
        {isScanning ? (
          <button 
            onClick={stopScanner}
            className="stop-button"
          >
            Pause Scanner
          </button>
        ) : (
          <button 
            onClick={startScanner}
            className="start-button"
            disabled={!permission}
          >
            Start Scanner
          </button>
        )}
      </div>
    </div>
  );
};

export default QRCodeScanner;
