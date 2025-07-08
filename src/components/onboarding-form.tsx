"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { generateMeGotchiAsset, type FormState } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadCloud, Sparkles, AlertCircle, CheckCircle, Wand2, RefreshCw } from "lucide-react";

type OnboardingFormProps = {
  inviteCode: string;
};

const formSchema = z.object({
  preferences: z.string().min(10, "Please describe your preferences in at least 10 characters.").max(500),
  photo: z
    .instanceof(File)
    .refine((file) => file.size > 0, "A photo is required.")
    .refine((file) => file.size < 4 * 1024 * 1024, "Photo must be less than 4MB.")
    .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only .jpg, .png, and .webp formats are supported."),
});

type FormData = z.infer<typeof formSchema>;

function SubmitButton({ isSuccess }: { isSuccess: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full font-bold" disabled={pending || isSuccess}>
      {pending ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : isSuccess ? (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          Done!
        </>
      ) : (
        <>
          <Wand2 className="mr-2 h-4 w-4" />
          Generate my Me-Gotchi!
        </>
      )}
    </Button>
  );
}

export function OnboardingForm({ inviteCode }: OnboardingFormProps) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const initialState: FormState = { status: "idle", message: "" };
  const [state, formAction] = useFormState(generateMeGotchiAsset, initialState);

  const { control, handleSubmit, formState: { errors }, watch, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      preferences: "",
      photo: new File([], ""),
    },
  });

  const photoFile = watch("photo");

  useEffect(() => {
    if (photoFile && photoFile.size > 0) {
      const url = URL.createObjectURL(photoFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [photoFile]);

  useEffect(() => {
    if (state.status === "error") {
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: state.message,
      });
    }
    if (state.status === "success") {
      toast({
        title: "Success!",
        description: state.message,
      });
    }
  }, [state, toast]);

  const formRef = React.useRef<HTMLFormElement>(null);

  const AssetPreview = useMemo(() => {
    const { pending } = useFormStatus();
    
    if (state.status === 'success' && state.imageUrl) {
        return <Image src={state.imageUrl} alt="Generated Me-Gotchi Asset" width={512} height={512} className="rounded-lg object-cover w-full h-full" data-ai-hint="avatar character" />;
    }
    if (pending) {
        return <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 bg-accent/30 rounded-lg"><Skeleton className="h-full w-full rounded-lg" /><div className="flex items-center space-x-2 text-foreground"><RefreshCw className="animate-spin h-5 w-5" /><p className="font-headline">AI is creating magic...</p></div></div>;
    }
    if (state.status === 'error') {
        return <div className="w-full h-full flex flex-col items-center justify-center text-destructive p-4"><AlertCircle className="h-16 w-16" /><p className="mt-4 font-semibold text-center">{state.message}</p></div>
    }
    return <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4"><Sparkles className="h-16 w-16" /><p className="mt-4 font-semibold text-center">Your generated asset will appear here</p></div>;
  // We need to use a key to get useFormStatus to update correctly inside memoized component
  }, [state]);


  return (
    <form ref={formRef} action={formAction} onSubmit={(e) => {
        handleSubmit(() => {
            formAction(new FormData(formRef.current!));
        })(e);
    }}>
      <input type="hidden" name="inviteCode" value={inviteCode} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">1. Personalize</CardTitle>
            <CardDescription>Tell us about yourself to shape your Me-Gotchi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="preferences" className="text-base font-semibold">Your Preferences</Label>
              <p className="text-sm text-muted-foreground">Describe your personality, hobbies, or style. e.g., "I love sci-fi, hiking, and wear glasses."</p>
              <Controller
                name="preferences"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id="preferences"
                    placeholder="Describe yourself here..."
                    className="min-h-[120px] text-base"
                    {...field}
                  />
                )}
              />
              {errors.preferences && <p className="text-sm font-medium text-destructive">{errors.preferences.message}</p>}
              {state.validationErrors?.preferences && <p className="text-sm font-medium text-destructive">{state.validationErrors.preferences[0]}</p>}
            </div>
            <div className="space-y-2">
               <Label htmlFor="photo" className="text-base font-semibold">Your Photo</Label>
               <p className="text-sm text-muted-foreground">Upload a clear photo of yourself. This will be used by the AI to generate your asset.</p>
                <Controller
                    name="photo"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (
                        <>
                            <div className="relative flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-secondary hover:bg-accent transition-colors ${errors.photo || state.validationErrors?.photo ? 'border-destructive' : 'border-border'}`}>
                                    {previewUrl ? (
                                        <Image src={previewUrl} alt="Photo preview" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG or WEBP (MAX. 4MB)</p>
                                        </div>
                                    )}
                                    <input id="dropzone-file" type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} {...rest} accept="image/png, image/jpeg, image/webp"/>
                                </label>
                            </div>
                             {errors.photo && <p className="text-sm font-medium text-destructive">{errors.photo.message}</p>}
                             {state.validationErrors?.photo && <p className="text-sm font-medium text-destructive">{state.validationErrors.photo[0]}</p>}
                        </>
                    )}
                />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">2. Generate Asset</CardTitle>
            <CardDescription>Your unique Me-Gotchi asset will be generated here.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="w-full aspect-square bg-secondary rounded-lg border border-dashed flex items-center justify-center overflow-hidden">
                {AssetPreview}
            </div>
          </CardContent>
          <CardFooter>
             <SubmitButton isSuccess={state.status === 'success'} />
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
