import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '@/hooks/use-user';
import { ButtonLoading } from '@/components/ui/loading';

interface DesktopUploadRestrictionModalProps {
  open: boolean;
  onClose: () => void;
  onInstall?: () => void;
}

export function DesktopUploadRestrictionModal({ open, onClose, onInstall }: DesktopUploadRestrictionModalProps) {
  const [copied, setCopied] = useState(false);
  const [sellLink, setSellLink] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const { user } = useUser();

  // Generate temporary QR token and authenticated URL
  const generateQRLink = async () => {
    const baseUrl = window.location.origin;
    const token = localStorage.getItem('token');

    if (!token || !user) {
      // Fallback to regular sell page if not authenticated
      return `${baseUrl}/#sell`;
    }

    try {
      setIsGeneratingToken(true);
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://retag-1n7d.onrender.com';
      const response = await fetch(`${API_BASE_URL}/auth/generate-qr-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Use temporary QR token for auto-login
        return `${baseUrl}/sell?token=${encodeURIComponent(data.qrToken)}`;
      } else {
        console.error('Failed to generate QR token');
        // Fallback to regular token
        return `${baseUrl}/sell?token=${encodeURIComponent(token)}`;
      }
    } catch (error) {
      console.error('Error generating QR token:', error);
      // Fallback to regular token
      return `${baseUrl}/sell?token=${encodeURIComponent(token)}`;
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Generate QR link when modal opens
  useEffect(() => {
    if (open) {
      generateQRLink().then(setSellLink);
    }
  }, [open, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sellLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Uploads Disabled on Desktop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <p className="text-lg font-semibold">Mobile Camera Required</p>
          <p className="text-sm text-muted-foreground">For authenticity, photos must be taken with your mobile camera only.</p>
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium">Scan to continue on mobile:</span>
            <div className="w-32 h-32 flex items-center justify-center rounded-md mb-2 bg-white p-2">
              {isGeneratingToken ? (
                <ButtonLoading size="md" />
              ) : (
                <QRCodeSVG value={sellLink || `${window.location.origin}/#sell`} size={112} />
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Auto-login included</p>
              <p>Camera-only upload</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-row gap-2 justify-center mt-4">
          {onInstall && <Button onClick={onInstall}>Install App</Button>}
          <Button variant="outline" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy Link'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 