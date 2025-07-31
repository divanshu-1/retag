import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '@/hooks/use-user';
import { ButtonLoading } from '@/components/ui/loading';
import { Download, Smartphone, Copy } from 'lucide-react';

interface AppInstallQRModalProps {
  open: boolean;
  onClose: () => void;
  onInstall?: () => void;
}

export function AppInstallQRModal({ open, onClose, onInstall }: AppInstallQRModalProps) {
  const [copied, setCopied] = useState(false);
  const [appLink, setAppLink] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const { user } = useUser();

  // Generate authenticated app URL
  const generateAppLink = async () => {
    const baseUrl = window.location.origin;
    const token = localStorage.getItem('token');

    if (!token || !user) {
      // Fallback to regular homepage if not authenticated
      return baseUrl;
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
        return `${baseUrl}?token=${encodeURIComponent(data.qrToken)}`;
      } else {
        console.error('Failed to generate QR token');
        // Fallback to regular token
        return `${baseUrl}?token=${encodeURIComponent(token)}`;
      }
    } catch (error) {
      console.error('Error generating QR token:', error);
      // Fallback to regular token
      return `${baseUrl}?token=${encodeURIComponent(token)}`;
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Generate app link when modal opens
  useEffect(() => {
    if (open) {
      generateAppLink().then(setAppLink);
    }
  }, [open, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(appLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Install ReTag App
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <p className="text-lg font-semibold">Get the Mobile Experience</p>
          <p className="text-sm text-muted-foreground">
            Scan the QR code with your mobile device to access ReTag with auto-login and install as an app.
          </p>
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium">Scan to open on mobile:</span>
            <div className="w-40 h-40 flex items-center justify-center rounded-lg mb-2 bg-white p-3 border">
              {isGeneratingToken ? (
                <ButtonLoading size="md" />
              ) : (
                <QRCodeSVG 
                  value={appLink || window.location.origin} 
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Auto-login included</p>
              <p>✓ Install as PWA</p>
              <p>✓ Full mobile experience</p>
            </div>
          </div>
          
          <div className="bg-muted/30 p-3 rounded-lg text-left">
            <p className="text-sm font-medium mb-2">How to install on mobile:</p>
            <ol className="text-xs text-muted-foreground space-y-1">
              <li>1. Scan QR code or open link</li>
              <li>2. Tap browser menu (⋮ or share button)</li>
              <li>3. Select "Add to Home Screen"</li>
              <li>4. Enjoy the app experience!</li>
            </ol>
          </div>
        </div>
        <DialogFooter className="flex flex-row gap-2 justify-center mt-4">
          {onInstall && (
            <Button onClick={onInstall} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Install Now
            </Button>
          )}
          <Button variant="outline" onClick={handleCopy} className="flex-1">
            <Copy className="h-4 w-4 mr-2" />
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
