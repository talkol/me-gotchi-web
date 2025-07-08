import { OnboardingForm } from "@/components/onboarding-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function OnboardingPage({
  params,
}: {
  params: { inviteCode: string };
}) {
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
          Create Your Me-Gotchi
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
