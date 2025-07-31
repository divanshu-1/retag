"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

interface LoadingProps {
  variant?: 'default' | 'minimal' | 'fullscreen' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

/**
 * Beautiful Loading Component for ReTag Marketplace
 * 
 * Features:
 * - Animated ReTag logo with pulsing effect
 * - Multiple variants for different use cases
 * - Smooth animations and transitions
 * - Branded colors and styling
 * - Responsive design
 */
export function Loading({ 
  variant = 'default', 
  size = 'md', 
  message = 'Loading...', 
  className 
}: LoadingProps) {
  
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-20 w-20'
  };

  const containerClasses = {
    default: 'flex flex-col items-center justify-center p-8',
    minimal: 'flex items-center justify-center p-4',
    fullscreen: 'fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50',
    inline: 'flex items-center space-x-2'
  };

  if (variant === 'fullscreen') {
    return (
      <div className={cn(containerClasses.fullscreen, className)}>
        <div className="relative">
          {/* Animated background circles */}
          <div className="absolute inset-0 -m-4">
            <div className="absolute inset-0 rounded-full bg-[#D6B899]/20 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-[#D6B899]/15 animate-ping animation-delay-75" />
          </div>

          {/* Logo container with glow effect */}
          <div className="relative bg-background rounded-full p-6 shadow-2xl border border-border">
            <div className="relative">
              {/* Glowing background */}
              <div className="absolute inset-0 bg-[#D6B899] rounded-full blur-xl opacity-30 animate-pulse" />

              {/* Logo */}
              <div className="relative">
                <Logo className={cn(sizeClasses.lg, "animate-pulse")} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Loading text with typing animation */}
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-semibold text-[#D6B899]">
            ReTag Marketplace
          </h2>
          <p className="text-muted-foreground mt-2 animate-pulse">
            {message}
          </p>

          {/* Loading dots animation */}
          <div className="flex justify-center mt-4 space-x-1">
            <div className="w-2 h-2 bg-[#D6B899] rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-[#D6B899]/80 rounded-full animate-bounce animation-delay-100" />
            <div className="w-2 h-2 bg-[#D6B899]/60 rounded-full animate-bounce animation-delay-200" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn(containerClasses.inline, className)}>
        <div className="relative">
          <div className="absolute inset-0 bg-[#D6B899] rounded-full blur-sm opacity-30 animate-pulse" />
          <Logo className={cn(sizeClasses[size], "animate-pulse")} />
        </div>
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn(containerClasses.minimal, className)}>
        <div className="relative">
          <div className="absolute inset-0 bg-[#D6B899] rounded-full blur-lg opacity-20 animate-pulse" />
          <Logo className={cn(sizeClasses[size], "animate-pulse")} />
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn(containerClasses.default, className)}>
      <div className="relative">
        {/* Animated rings */}
        <div className="absolute inset-0 -m-2">
          <div className="absolute inset-0 rounded-full border-2 border-[#D6B899]/30 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-[#D6B899]/20 animate-ping animation-delay-75" />
        </div>

        {/* Logo with glow */}
        <div className="relative bg-background rounded-full p-4 border border-border shadow-lg">
          <div className="absolute inset-0 bg-[#D6B899]/10 rounded-full animate-pulse" />
          <Logo className={cn(sizeClasses[size], "relative animate-pulse")} />
        </div>
      </div>

      <p className="text-muted-foreground mt-4 animate-pulse">{message}</p>

      {/* Progress bar */}
      <div className="w-32 h-1 bg-muted rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-[#D6B899] rounded-full animate-loading-bar" />
      </div>
    </div>
  );
}

/**
 * Page Loading Component
 * For full page loading states
 */
export function PageLoading({ message = "Loading page..." }: { message?: string }) {
  return <Loading variant="fullscreen" message={message} />;
}

/**
 * Section Loading Component  
 * For loading states within sections
 */
export function SectionLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loading variant="default" size="md" message={message} />
    </div>
  );
}

/**
 * Button Loading Component
 * For loading states in buttons
 */
export function ButtonLoading({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <Loading variant="minimal" size={size} />;
}

/**
 * Redirect Loading Component
 * For redirect pages with branded messaging
 */
export function RedirectLoading({ 
  destination, 
  message 
}: { 
  destination: string; 
  message?: string; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="text-center">
        <Loading variant="default" size="lg" message={message || `Redirecting to ${destination}...`} />
        <p className="text-xs text-muted-foreground mt-4">
          Taking you to the best thrift experience...
        </p>
      </div>
    </div>
  );
}
