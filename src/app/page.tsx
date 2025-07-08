import { InviteForm } from "@/components/invite-form";
import { Heart, Sparkles, Bot } from "lucide-react";

export default function Home() {
  return (
    <div className="dark">
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]"><div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#d8b4fe,transparent)]"></div></div>
        
        <div className="z-10 flex flex-col items-center text-center">
            <div className="bg-primary/20 text-primary-foreground p-2 rounded-full mb-6 flex items-center gap-2 border border-primary/30">
                <Bot className="w-10 h-10 bg-primary/80 text-primary-foreground p-2 rounded-full" />
            </div>

            <h1 className="font-headline text-5xl md:text-7xl font-bold text-foreground">
                Me-Gotchi Web
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Welcome! Enter your exclusive invite code to begin your journey and create a personalized digital companion.
            </p>
        </div>

        <div className="z-10 mt-8 w-full max-w-md">
          <InviteForm />
        </div>
        
        <div className="z-10 mt-16 grid grid-cols-1 gap-8 text-center md:grid-cols-3 md:max-w-5xl">
            <div className="flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                    <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-foreground">Personalized</h3>
                <p className="mt-2 text-muted-foreground">Your Me-Gotchi is a unique reflection of you, based on your photo and preferences.</p>
            </div>
            <div className="flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                    <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-foreground">AI-Powered</h3>
                <p className="mt-2 text-muted-foreground">Leveraging cutting-edge AI to generate one-of-a-kind digital assets for your companion.</p>
            </div>
            <div className="flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
                    <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-foreground">Game Ready</h3>
                <p className="mt-2 text-muted-foreground">Your generated asset integrates seamlessly with the Me-Gotchi Android game.</p>
            </div>
        </div>
      </main>
    </div>
  );
}
