"use client";
import React from "react";
import { OnboardingForm } from "@/components/onboarding-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function OnboardingPage({
  params: paramsPromise,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const params = React.use(paramsPromise);

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
            {params.inviteCode}
          </span>
        </div>
      </div>
      <div className="mt-8">
        <OnboardingForm inviteCode={params.inviteCode} />
      </div>
    </main>
  );
}
