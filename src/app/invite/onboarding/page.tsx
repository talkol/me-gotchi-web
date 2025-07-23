"use client";
import React, { useEffect, useState } from "react";
import { OnboardingForm } from "@/components/onboarding-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get invite code from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromQuery = urlParams.get('code');
    
    if (codeFromQuery) {
      setInviteCode(codeFromQuery);
    } else {
      setError("No invite code provided");
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    const validateInviteCode = async () => {
      if (!inviteCode) return;
      
      try {
        setIsValidating(true);
        setError(null);
        
        // Try to fetch the preferences.json file for this invite code
        const preferencesUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(inviteCode)}/preferences.json`;
        const response = await fetch(preferencesUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const preferences = await response.json();
        
        // Check if the preferences file has the expected structure
        if (!preferences.inviteCode || preferences.inviteCode !== inviteCode) {
          throw new Error("Invalid preferences file structure");
        }
        
        setIsValid(true);
      } catch (error) {
        console.error("Error validating invite code:", error);
        setError("Invalid or expired invite code. Please check the code and try again.");
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    if (inviteCode) {
      validateInviteCode();
    }
  }, [inviteCode]);

  if (isValidating) {
    return (
      <main className="container mx-auto py-8 px-4">
        <div className="absolute top-4 left-4">
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Validating invite code...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isValid) {
    return (
      <main className="container mx-auto py-8 px-4">
        <div className="absolute top-4 left-4">
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Invalid Invite Code</CardTitle>
              <CardDescription>
                {error || "The invite code you entered is not valid."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild className="w-full">
                <Link href="/">
                  Return to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="absolute top-4 left-4">
        <Button asChild variant="ghost">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <div className="text-center">
        <h1 className="font-headline text-4xl md:text-5xl font-bold">
          Create Me-gotchi
        </h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s personalize your digital companion.
        </p>
        <div className="inline-block bg-muted text-sm rounded-full px-4 py-1 mt-4">
          Invite Code:{" "}
          <span className="font-bold text-foreground">
            {inviteCode}
          </span>
        </div>
      </div>
      <div className="mt-8">
        <OnboardingForm inviteCode={inviteCode} />
      </div>
    </main>
  );
} 