import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import '../styles/qrcode.css';

const QRCodeGenerator = ({ data, size = 200, logo = true }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const generateQR = async () => {
      try {
        // Clear the canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Generate QR code
        await QRCode.toCanvas(canvas, data, {
          width: size,
          margin: 1,
          color: {
            dark: '#000',
            light: '#fff'
          },
          errorCorrectionLevel: 'H' // High - allows for 30% of the QR code to be restored
        });
        
        // Add logo if enabled
        if (logo) {
          const img = new Image();
          img.onload = () => {
            // Calculate logo size (20% of QR code)
            const logoSize = size * 0.2;
            const logoX = (size - logoSize) / 2;
            const logoY = (size - logoSize) / 2;
            
            // Create a white background circle for the logo
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, logoSize * 0.55, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            
            // Draw the logo
            ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
          };
          img.src = '/images/logo-dark.svg';
        }
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [data, size, logo]);

  return (
    <div className="qr-code">
      <canvas 
        ref={canvasRef} 
        width={size} 
        height={size}
        className="qr-canvas"
      />
    </div>
  );
};

export default QRCodeGenerator;
