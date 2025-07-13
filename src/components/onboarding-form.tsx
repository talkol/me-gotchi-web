
"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useForm, useFieldArray, Control, UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { app } from "@/lib/firebase";
import { getFunctions, httpsCallable, type HttpsCallableError } from "firebase/functions";


import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { UploadCloud, Sparkles, AlertCircle, CheckCircle, Wand2, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";

type OnboardingFormProps = {
  inviteCode: string;
};

// Client-side Zod schema
const FoodItemSchema = z.object({
  name: z.string().max(11, "Max 11 chars"),
  addExplanation: z.boolean(),
  explanation: z.string(),
});
const ActivityItemSchema = z.object({
  name: z.string().max(11, "Max 11 chars"),
  addExplanation: z.boolean(),
  explanation: z.string(),
});
const EnvironmentItemSchema = z.object({
  explanation: z.string(),
});

// Full schema for client-side validation context with step-aware logic
const OnboardingFormSchema = z.object({
  firstName: z.string().max(11, "Max 11 characters.").optional(),
  gender: z.enum(["male", "female"]).optional(),
  age: z.coerce.number().min(1, "Must be at least 1.").max(120, "Must be 120 or less.").optional(),
  photo: z.any().optional(),
  
  likedFoods: z.array(FoodItemSchema).length(3),
  dislikedFoods: z.array(FoodItemSchema).length(3),
  likedDrinks: z.array(FoodItemSchema).length(2),
  dislikedDrinks: z.array(FoodItemSchema).length(1),

  likedFunActivities: z.array(ActivityItemSchema).length(3),
  dislikedFunActivities: z.array(ActivityItemSchema).length(2),
  likedExerciseActivities: z.array(ActivityItemSchema).length(2),
  dislikedExerciseActivities: z.array(ActivityItemSchema).length(1),
  
  environments: z.array(EnvironmentItemSchema).length(4),
  
  inviteCode: z.string().min(1),
  step: z.coerce.number().min(1).max(5),
  imageUrl: z.string().optional(),
  imageUrls: z.record(z.string()).optional(),
  generationType: z.string().optional(),
}).superRefine((data, ctx) => {
    const step = data.step;

    if (step >= 1) {
        if (!data.firstName || data.firstName.trim().length === 0) {
            ctx.addIssue({ path: ['firstName'], message: 'First name is required.', code: 'custom'});
        }
        if (data.firstName && data.firstName.length > 11) {
            ctx.addIssue({ path: ['firstName'], message: 'Max 11 characters.', code: 'custom'});
        }
        if (!data.gender) {
            ctx.addIssue({ path: ['gender'], message: 'Please select a gender.', code: 'custom'});
        }
        if (data.age === undefined || data.age === null) {
            ctx.addIssue({ path: ['age'], message: 'Age is required.', code: 'custom'});
        }
        if (!(data.photo instanceof File) || data.photo.size === 0) {
            // Only require a photo if one hasn't been uploaded yet (i.e., imageUrl is not set)
            if (!data.imageUrls?.character) {
                ctx.addIssue({ path: ['photo'], message: 'A photo is required.', code: 'custom'});
            }
        } else {
             if (data.photo.size > 4 * 1024 * 1024) ctx.addIssue({ path: ['photo'], message: 'Photo must be less than 4MB.', code: 'custom'});
             if (!["image/jpeg", "image/png", "image/webp"].includes(data.photo.type)) ctx.addIssue({ path: ['photo'], message: 'Only .jpg, .png, and .webp formats are supported.', code: 'custom'});
        }
    }

    if (step >= 2) {
        data.likedFoods.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedFoods.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedFoods.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedFoods.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.likedDrinks.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedDrinks.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedDrinks.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedDrinks.${idx}.name`], message: 'This field is required.', code: 'custom'})});
    }

    if (step >= 3) {
        data.likedFunActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedFunActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedFunActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedFunActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.likedExerciseActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedExerciseActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedExerciseActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedExerciseActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
    }

    if (step >= 4) {
        data.environments.forEach((i, idx) => { if (!i.explanation || i.explanation.trim() === '') ctx.addIssue({path: [`environments.${idx}.explanation`], message: 'This field is required.', code: 'custom'})});
    }
});
type OnboardingFormData = z.infer<typeof OnboardingFormSchema>;

type StepImageUrls = Record<string, string>;

type GenerationState = {
    status: "idle" | "success" | "error" | "generating";
    message: string;
    imageUrl?: string;
    generationType?: string;
};

type StepGenerationConfig = {
    title: string;
    generationType: string;
    imageUrlKey: keyof StepImageUrls;
    dependencies?: (keyof StepImageUrls)[];
};

type StepConfig = {
    id: number;
    title: string;
    fields: (keyof OnboardingFormData)[];
    generations: StepGenerationConfig[];
};

const STEPS: StepConfig[] = [
  { id: 1, title: "Appearance", fields: ["firstName", "gender", "age", "photo"], generations: [
      { title: "Generate Character", generationType: "character", imageUrlKey: "character" },
      { title: "Generate Expressions", generationType: "expressions", imageUrlKey: "expressions", dependencies: ["character"]},
      { title: "Remove Background", generationType: "removeBg", imageUrlKey: "removeBg", dependencies: ["character"]},
  ] },
  { id: 2, title: "Food Preferences", fields: ["likedFoods", "dislikedFoods", "likedDrinks", "dislikedDrinks"], generations: [
      { title: "Generate Icons", generationType: "foodIcons", imageUrlKey: "foodIcons", dependencies: ["character"] },
      { title: "Remove Background", generationType: "foodRemoveBg", imageUrlKey: "foodRemoveBg", dependencies: ["foodIcons"] },
  ] },
  { id: 3, title: "Activity Preferences", fields: ["likedFunActivities", "dislikedFunActivities", "likedExerciseActivities", "dislikedExerciseActivities"], generations: [
       { title: "Generate Icons", generationType: "activitiesIcons", imageUrlKey: "activitiesIcons", dependencies: ["character"] },
       { title: "Remove Background", generationType: "activitiesRemoveBg", imageUrlKey: "activitiesRemoveBg", dependencies: ["activitiesIcons"] },
  ] },
  { id: 4, title: "Environments", fields: ["environments"], generations: [
      { title: "Generate 1", generationType: "environment1", imageUrlKey: "environment1", dependencies: ["character"] },
      { title: "Generate 2", generationType: "environment2", imageUrlKey: "environment2", dependencies: ["character"] },
      { title: "Generate 3", generationType: "environment3", imageUrlKey: "environment3", dependencies: ["character"] },
      { title: "Generate 4", generationType: "environment4", imageUrlKey: "environment4", dependencies: ["character"] },
  ] },
  { id: 5, title: "All Set!", fields: [], generations: [] },
];

const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const AssetPreview = ({ imageUrl, isGenerating, status, message }: { imageUrl?: string; isGenerating: boolean, status: GenerationState['status'], message: string }) => {
    const showLoading = isGenerating && !imageUrl;
    const showPreviousImageWhileLoading = isGenerating && imageUrl;

    const AssetDisplay = useMemo(() => {
        if (showPreviousImageWhileLoading || imageUrl) {
             return (
                <div className="relative w-full h-full">
                    <Image src={imageUrl!} alt="Generated Me-Gotchi Asset" width={512} height={512} className="rounded-lg object-cover w-full h-full" data-ai-hint="avatar character" />
                    {showPreviousImageWhileLoading && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
                           <div className="flex items-center space-x-2 text-foreground p-4 rounded-lg bg-background/80"><RefreshCw className="animate-spin h-5 w-5" /><p className="font-headline">Regenerating...</p></div>
                        </div>
                    )}
                </div>
            );
        }
        if (showLoading) {
            return <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 bg-accent/30 rounded-lg"><Skeleton className="h-full w-full rounded-lg" /><div className="flex items-center space-x-2 text-foreground"><RefreshCw className="animate-spin h-5 w-5" /><p className="font-headline">AI is creating magic...</p></div></div>;
        }
        if (status === 'error') {
            return <div className="w-full h-full flex flex-col items-center justify-center text-destructive p-4"><AlertCircle className="h-16 w-16" /><p className="mt-4 font-semibold text-center">{message}</p></div>
        }
        return <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4"><Sparkles className="h-16 w-16" /><p className="mt-4 font-semibold text-center">Your generated asset will appear here</p></div>;
    }, [imageUrl, isGenerating, status, message, showPreviousImageWhileLoading, showLoading]);

    return (
        <div className="w-full mx-auto aspect-square bg-secondary rounded-lg border border-dashed flex items-center justify-center overflow-hidden">
            {AssetDisplay}
        </div>
    );
};

const GenerationUnit = ({
    title,
    generationType,
    imageUrl,
    state,
    isGenerating,
    hasBeenGenerated,
    isLocked,
    onGenerate
}: {
    title: string;
    generationType: string;
    imageUrl?: string;
    state: GenerationState;
    isGenerating: boolean;
    hasBeenGenerated: boolean;
    isLocked: boolean;
    onGenerate: (generationType: string) => void;
}) => (
    <div className="flex flex-col justify-start h-full space-y-4">
        <Button
            type="button"
            size="lg"
            className="w-full font-bold"
            disabled={isGenerating || isLocked}
            onClick={() => { if (!isLocked) onGenerate(generationType); }}
        >
            {isGenerating ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : hasBeenGenerated ? (
                <><CheckCircle className="mr-2 h-4 w-4" /> Regenerate</>
            ) : (
                <><Wand2 className="mr-2 h-4 w-4" /> {title}</>
            )}
        </Button>
        <AssetPreview imageUrl={imageUrl} isGenerating={isGenerating} status={state.status} message={state.message} />
    </div>
);


const PreferenceItem = ({
  control, name, index, watch, placeholderName, placeholderDescription,
}: {
  control: Control<OnboardingFormData>;
  name: `likedFoods` | `dislikedFoods` | `likedDrinks` | `dislikedDrinks` | `likedFunActivities` | `dislikedFunActivities` | `likedExerciseActivities` | `dislikedExerciseActivities`;
  index: number;
  watch: UseFormWatch<OnboardingFormData>;
  placeholderName: string;
  placeholderDescription: string;
}) => {
  const showExplanation = watch(`${name}.${index}.addExplanation`);

  return (
    <div className="space-y-2 p-3 border rounded-md bg-background">
       <FormField
        control={control}
        name={`${name}.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input {...field} placeholder={placeholderName} className="text-base" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
          control={control}
          name={`${name}.${index}.addExplanation`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-sm font-medium leading-none">
                Add explanation
              </FormLabel>
            </FormItem>
          )}
        />
      {showExplanation && (
         <FormField
          control={control}
          name={`${name}.${index}.explanation`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea {...field} placeholder={placeholderDescription} className="text-base" />
              </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
};

const StepCard = ({ title, children, generationUnits }: {
    title: string;
    children: React.ReactNode;
    generationUnits: React.ReactNode;
}) => (
    <Card className="shadow-lg">
        <CardHeader><CardTitle className="font-headline text-2xl">{title}</CardTitle></CardHeader>
        <CardContent>
            {children}
            <Separator className="my-8" />
             <div>
                <h3 className="text-xl font-headline mb-4">Result</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                   {generationUnits}
                </div>
            </div>
        </CardContent>
    </Card>
);

const Step1 = ({ control, watch }: { control: Control<OnboardingFormData>, watch: UseFormWatch<OnboardingFormData> }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const photoFile = watch("photo");
    useEffect(() => {
        if (photoFile instanceof File && photoFile.size > 0) {
            const url = URL.createObjectURL(photoFile);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreviewUrl(null);
    }, [photoFile]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8
    ">
        <div className="space-y-6">
            <FormField control={control} name="firstName" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">First Name</FormLabel>
                    <FormControl><Input placeholder="eg: Leo" {...field} value={field.value ?? ''} className="text-base"/></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={control} name="gender" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Gender</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
              <FormField control={control} name="age" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Age</FormLabel>
                    <FormControl><Input type="number" placeholder="eg: 8" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="text-base"/></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </div>
        <FormField control={control} name="photo" render={({ field: { onChange, value, ...rest }, fieldState }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">Face Photo</FormLabel>
              <FormControl>
                <div className="relative flex items-center justify-center w-full h-full min-h-[256px]">
                  <label htmlFor="dropzone-file" className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer bg-secondary hover:bg-accent transition-colors ${fieldState.error ? 'border-destructive' : 'border-border'}`}>
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Photo preview" fill objectFit="contain" className="rounded-lg p-2" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Front-looking photo of face and upper body</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG or WEBP (MAX. 4MB)</p>
                      </div>
                    )}
                    <input id="dropzone-file" type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} {...rest} accept="image/png, image/jpeg, image/webp" />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
        )} />
    </div>
  );
};
const Step2 = ({ control, watch }: { control: Control<OnboardingFormData>, watch: UseFormWatch<OnboardingFormData> }) => {
    const { fields: likedFoods } = useFieldArray({ control, name: 'likedFoods' });
    const { fields: dislikedFoods } = useFieldArray({ control, name: 'dislikedFoods' });
    const { fields: likedDrinks } = useFieldArray({ control, name: 'likedDrinks' });
    const { fields: dislikedDrinks } = useFieldArray({ control, name: 'dislikedDrinks' });
  return (
    <div className="space-y-6">
        <div>
            <h3 className="font-semibold text-lg mb-2">Foods Liked (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedFoods.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedFoods" placeholderName="eg: PIZZA" placeholderDescription="eg: A single slice of pizza with pepperoni on top" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Foods Disliked (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dislikedFoods.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedFoods" placeholderName="eg: BROCCOLI" placeholderDescription="Steamed broccoli florets" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Drinks Liked (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedDrinks.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedDrinks" placeholderName="eg: APPLE JUICE" placeholderDescription="A glass of apple juice without any labels" />)}
            </div>
        </div>
         <div>
            <h3 className="font-semibold text-lg mb-2">Drinks Disliked (1)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dislikedDrinks.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedDrinks" placeholderName="eg: MILK" placeholderDescription="A glass of plain milk" />)}
            </div>
        </div>
    </div>
  );
};
const Step3 = ({ control, watch }: { control: Control<OnboardingFormData>, watch: UseFormWatch<OnboardingFormData> }) => {
    const { fields: likedFun } = useFieldArray({ control, name: 'likedFunActivities' });
    const { fields: dislikedFun } = useFieldArray({ control, name: 'dislikedFunActivities' });
    const { fields: likedExercise } = useFieldArray({ control, name: 'likedExerciseActivities' });
    const { fields: dislikedExercise } = useFieldArray({ control, name: 'dislikedExerciseActivities' });
  return (
    <div className="space-y-6">
        <div>
            <h3 className="font-semibold text-lg mb-2">Leisure Activities Liked (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedFun.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedFunActivities" placeholderName="eg: PLAYSTATION" placeholderDescription="A white ps5 console standing upright" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Leisure Activities Disliked (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dislikedFun.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedFunActivities" placeholderName="eg: READING" placeholderDescription="An open book on a table" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Exercise Activities Liked (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedExercise.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedExerciseActivities" placeholderName="eg: FOOTBALL" placeholderDescription="A soccer ball" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Exercise Activities Disliked (1)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dislikedExercise.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedExerciseActivities" placeholderName="eg: RUNNING" placeholderDescription="A person running from profile view" />)}
            </div>
        </div>
    </div>
  );
};

const Step4 = ({ control }: { control: Control<OnboardingFormData> }) => {
  const { fields: environments } = useFieldArray({ control, name: 'environments' });
  return (
    <div className="space-y-4">
        <CardDescription>Describe environments the character will normally visit.</CardDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {environments.map((item, index) => (
            <FormField
                key={item.id}
                control={control}
                name={`environments.${index}.explanation`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Environment {index + 1}</FormLabel>
                    <FormControl>
                    <Textarea {...field} placeholder="eg: vibrant colorful children playroom that has toys and games and is appropriate for a 9 years old boy named Leo" className="min-h-[80px] text-base" />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            ))}
        </div>
    </div>
  );
};

const Step5 = ({ inviteCode }: { inviteCode: string }) => (
    <Card className="shadow-lg text-center">
        <CardHeader>
            <CardTitle className="font-headline text-3xl">All Set!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center p-6">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            <p className="text-lg text-muted-foreground max-w-prose">
                Your unique Me-gotchi is ready! To bring it to life, download the Me-gotchi app from the Google Play Store and enter your invite code when prompted.
            </p>
            <div className="mt-8">
                <p className="text-sm text-muted-foreground">Your Invite Code:</p>
                <p className="font-mono text-2xl font-bold bg-muted rounded-md py-2 px-4 inline-block mt-1">{inviteCode}</p>
            </div>
        </CardContent>
    </Card>
);

export function OnboardingForm({ inviteCode }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  
  const [imageUrls, setImageUrls] = useState<StepImageUrls>({});
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null);

  const [lastResult, setLastResult] = useState<GenerationState>({ status: "idle", message: "" });
  
  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(OnboardingFormSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      gender: undefined,
      age: undefined,
      photo: undefined,
      inviteCode: inviteCode,
      step: 1,
      imageUrl: "",
      imageUrls: {},
      likedFoods: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedFoods: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedDrinks: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedDrinks: [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedFunActivities: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedFunActivities: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedExerciseActivities: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedExerciseActivities: [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      environments: [...Array(4)].map(() => ({ explanation: "" })),
    },
  });

  const { control, handleSubmit, watch, setError, setValue, trigger, getValues } = form;

  useEffect(() => {
    setValue('step', currentStep, { shouldValidate: true });
    setValue('imageUrls', imageUrls);
  }, [currentStep, setValue, imageUrls]);
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    if (lastResult.status === "error") {
      setActiveGeneration(null);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: lastResult.message || "Please check the form for errors.",
      });
    }
    if (lastResult.status === "success" && lastResult.imageUrl && lastResult.generationType) {
       setActiveGeneration(null);
       const generationType = lastResult.generationType as keyof StepImageUrls;

       setImageUrls(prev => ({...prev, [generationType]: lastResult.imageUrl!}));
       
       if (generationType === 'character') {
         setValue("imageUrl", lastResult.imageUrl);
       }

       if (currentStep !== 4) {
        toast({
            title: "Generation Complete!",
            description: lastResult.message
        });
       }
    }
  }, [lastResult, toast, setValue, currentStep]);

  const handleNext = async () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };
  
  const onGenerate = async (generationType: string) => {
    const stepConfig = STEPS.find(s => s.id === currentStep);
    if (!stepConfig) return;

    const isValid = await trigger(stepConfig.fields as any);
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill out all required fields for this step before generating.",
        });
        return;
    }

    setActiveGeneration(generationType);
    
    try {
        const functionsInstance = getFunctions(app, 'us-central1');
        const generateAsset = httpsCallable(functionsInstance, 'generateAssetAppearanceCharacter');
        const currentValues = getValues();
        
        let photoDataUri: string | undefined;
        if (currentValues.photo instanceof File && currentValues.photo.size > 0) {
            photoDataUri = await fileToDataURI(currentValues.photo);
        }

        const payload = {
            generationType,
            inviteCode: currentValues.inviteCode,
            photoDataUri,
            imageUrls: imageUrls,
            // We can add more form data to the payload here as needed
        };

        const result = await generateAsset(payload) as { data: { assetUrl: string } };
        
        setLastResult({
            status: 'success',
            message: 'Asset generated successfully!',
            imageUrl: result.data.assetUrl,
            generationType: generationType,
        });

    } catch (error) {
        console.error("Full Firebase function call error:", error);
        const functionsError = error as HttpsCallableError;
        const errorMessage = `Code: ${functionsError.code}. Message: ${functionsError.message}. Details: ${JSON.stringify(functionsError.details)}`;
        
        setLastResult({
            status: 'error',
            message: errorMessage,
            generationType: generationType,
        });
    }
  }
  
  const stepConfig = STEPS.find(s => s.id === currentStep);
  const isStepComplete = stepConfig?.generations.every(g => !!imageUrls[g.imageUrlKey as keyof StepImageUrls]) ?? false;
  
  const renderGenerationUnits = (step: number) => {
      const config = STEPS.find(s => s.id === step);
      if (!config) return null;

      return config.generations.map(genConfig => {
          const genType = genConfig.generationType;
          const isGenerating = activeGeneration === genType;
          const hasBeenGenerated = !!imageUrls[genConfig.imageUrlKey];
          const resultForThisUnit = lastResult.generationType === genType ? lastResult : { status: 'idle', message: '' };
          
          const dependenciesMet = genConfig.dependencies?.every(dep => !!imageUrls[dep as keyof StepImageUrls]) ?? true;
          const isLocked = !dependenciesMet;

          return (
            <GenerationUnit
              key={genType}
              title={genConfig.title}
              generationType={genType}
              imageUrl={imageUrls[genConfig.imageUrlKey]}
              state={resultForThisUnit}
              isGenerating={isGenerating}
              hasBeenGenerated={hasBeenGenerated}
              isLocked={isLocked}
              onGenerate={onGenerate}
            />
          );
      });
  }

  return (
    <div>
      <div className="mb-8 space-y-2">
        <Progress value={currentStep * 20} className="w-full" />
        <p className="text-center text-sm text-muted-foreground font-medium">{`Step ${currentStep} of 5: ${STEPS[currentStep-1].title}`}</p>
      </div>
       <Form {...form}>
        <form noValidate className="space-y-8">
            <input type="hidden" {...form.register("inviteCode")} />
            <input type="hidden" {...form.register("step")} />
            <input type="hidden" {...form.register("imageUrl")} />
            <input type="hidden" {...form.register("generationType")} />

            <div className={currentStep === 1 ? 'block' : 'hidden'}>
                <StepCard title="Step 1: Appearance" generationUnits={renderGenerationUnits(1)}>
                    <Step1 control={control} watch={watch} />
                </StepCard>
            </div>
            <div className={currentStep === 2 ? 'block' : 'hidden'}>
                <StepCard title="Step 2: Food Preferences" generationUnits={renderGenerationUnits(2)}>
                    <Step2 control={control} watch={watch} />
                </StepCard>
            </div>
            <div className={currentStep === 3 ? 'block' : 'hidden'}>
                <StepCard title="Step 3: Activity Preferences" generationUnits={renderGenerationUnits(3)}>
                    <Step3 control={control} watch={watch} />
                </StepCard>
            </div>
             <div className={currentStep === 4 ? 'block' : 'hidden'}>
                <StepCard title="Step 4: Environments" generationUnits={renderGenerationUnits(4)}>
                    <Step4 control={control} />
                </StepCard>
            </div>
            <div className={currentStep === 5 ? 'block' : 'hidden'}>
                <Step5 inviteCode={inviteCode} />
            </div>

            <div className={`mt-8 flex items-center ${currentStep === 5 ? 'justify-center' : 'justify-between'}`}>
                <Button type="button" variant="outline" onClick={handlePrevious} className={currentStep === 1 || currentStep === 5 ? 'invisible' : 'visible'}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>

                {currentStep === 5 && (
                     <Button type="button" variant="outline" onClick={handlePrevious}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                )}
                
                {currentStep < 4 && (
                    <Button type="button" size="lg" onClick={handleNext} disabled={!isStepComplete || !!activeGeneration}>
                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )}

                {currentStep === 4 && (
                     <Button type="button" size="lg" onClick={handleNext} disabled={!isStepComplete || !!activeGeneration}>
                        Done <CheckCircle className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
        </form>
      </Form>
    </div>
  );
}
