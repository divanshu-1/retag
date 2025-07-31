'use client';

import { LoginButton } from '@/components/auth/login-button';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, Star, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { useState, useEffect } from 'react';
import { AppInstallQRModal } from '@/components/ui/app-install-qr-modal';

const features = [
  {
    icon: <Smartphone className="h-10 w-10 text-primary" />,
    title: 'Mobile Optimized',
    description: 'Responsive across all devices',
  },
  {
    icon: <Download className="h-10 w-10 text-primary" />,
    title: 'Install as App',
    description: 'Native app experience',
  },
  {
    icon: <Star className="h-10 w-10 text-primary" />,
    title: 'Quality Assured',
    description: 'Every item verified',
  },
];

export default function CommunityCTA() {
  const { isLoggedIn } = useUser();
  const [isMobile, setIsMobile] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: any) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setInstallPromptEvent(null);
    }
  };

  const handleContinueOnMobile = () => {
    // For mobile users, try PWA install directly
    if (isMobile) {
      if (installPromptEvent) {
        handleInstallPWA();
      } else {
        // Show toast or modal with instructions
        alert('To install ReTag: \n1. Tap the share button in your browser\n2. Select "Add to Home Screen"\n3. Enjoy the app experience!');
      }
    } else {
      // For desktop, show QR code modal
      setShowQRModal(true);
    }
  };

  return (
    <section className="bg-card py-12 sm:py-16">
      <div className="container max-w-7xl mx-auto text-center">
        <h2 className="text-4xl font-black tracking-tight text-primary">
          Join ReTag Community
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {isLoggedIn
            ? "Get the best ReTag experience on your device"
            : "Sign up with Google and start your sustainable fashion journey"
          }
        </p>
        <div className="mt-8 flex justify-center">
          {isLoggedIn ? (
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-6 text-lg font-medium"
              onClick={handleContinueOnMobile}
            >
              <Download className="h-5 w-5 mr-2" />
              {isMobile ? "Install PWA" : "Install as App"}
            </Button>
          ) : (
            <LoginButton>
              <Button variant="outline" size="lg" className="px-8 py-6 text-lg font-medium">
                <Search className="h-5 w-5 mr-2" /> Continue with Google
              </Button>
            </LoginButton>
          )}
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center gap-4 p-6 bg-background rounded-lg shadow-sm border"
            >
              {feature.icon}
              <h3 className="font-bold text-lg">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* QR Code Modal */}
        <AppInstallQRModal
          open={showQRModal}
          onClose={() => setShowQRModal(false)}
          onInstall={installPromptEvent ? handleInstallPWA : undefined}
        />
      </div>
    </section>
  );
}
