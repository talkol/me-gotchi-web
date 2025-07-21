
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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
import { HexColorPicker, HexColorInput } from "react-colorful";

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
 favoriteColor: z.string().optional(), // Add favoriteColor field
  foodBackgroundColor: z.string().optional(), // Add foodBackgroundColor field
  activitiesBackgroundColor: z.string().optional(), // Add activitiesBackgroundColor field
  
  likedFoods: z.array(FoodItemSchema).length(3),
  dislikedFoods: z.array(FoodItemSchema).length(3),
  likedDrinks: z.array(FoodItemSchema).length(2),
  dislikedDrinks: z.array(FoodItemSchema).length(1),

  likedFunActivities: z.array(ActivityItemSchema).length(3),
  dislikedFunActivities: z.array(ActivityItemSchema).length(2),
  likedExerciseActivities: z.array(ActivityItemSchema).length(2),
  dislikedExerciseActivities: z.array(ActivityItemSchema).length(1),
  
  environmentNumber: z.number().min(1).max(4).optional(),
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
        if (!data.favoriteColor || data.favoriteColor.trim().length === 0) {
            ctx.addIssue({ path: ['favoriteColor'], message: 'Favorite color is required.', code: 'custom'});
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
        if (!data.foodBackgroundColor || data.foodBackgroundColor.trim().length === 0) {
          ctx.addIssue({ path: ['foodBackgroundColor'], message: 'Food Background Color is required.', code: 'custom'});
        }
    }

    if (step >= 3) {
        data.likedFunActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedFunActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedFunActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedFunActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.likedExerciseActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`likedExerciseActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        data.dislikedExerciseActivities.forEach((i, idx) => { if (!i.name || i.name.trim() === '') ctx.addIssue({path: [`dislikedExerciseActivities.${idx}.name`], message: 'This field is required.', code: 'custom'})});
        if (!data.activitiesBackgroundColor || data.activitiesBackgroundColor.trim().length === 0) {
          ctx.addIssue({ path: ['activitiesBackgroundColor'], message: 'Activities Background Color is required.', code: 'custom'});
        }
    }

    if (step >= 4) {
        data.environments.forEach((i, idx) => { if (!i.explanation || i.explanation.trim() === '') ctx.addIssue({path: [`environments.${idx}.explanation`], message: 'This field is required.', code: 'custom'})});
    }
});
type OnboardingFormData = z.infer<typeof OnboardingFormSchema>;

type StepImageUrls = Record<string, string>;

type GenerationState = {
    status: "idle" | "success" | "error";
    message: string;
    imageUrl?: string;
    generationType?: string;
};

type EnvironmentGenerationState = {
 status: "idle" | "success" | "error" | "generating";
    progress?: number; // Optional: for future progress tracking
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
      { title: "Generate Character", generationType: "character", imageUrlKey: "character" }, // fields: ["firstName", "gender", "age", "photo", "favoriteColor"]
      { title: "Generate Expressions", generationType: "expressions", imageUrlKey: "expressions", dependencies: ["character"] }, // fields: ["firstName", "gender", "age", "photo", "favoriteColor"]
  ]},
  { id: 2, title: "Food Preferences", fields: ["likedFoods", "dislikedFoods", "likedDrinks", "dislikedDrinks"], generations: [ // fields: ["likedFoods", "dislikedFoods", "likedDrinks", "dislikedDrinks", "foodBackgroundColor"]
      { title: "Generate Icons", generationType: "foodIcons", imageUrlKey: "foodIcons", dependencies: ["character"] }
  ]},
  { id: 3, title: "Activity Preferences", fields: ["likedFunActivities", "dislikedFunActivities", "likedExerciseActivities", "dislikedExerciseActivities"], generations: [
       { title: "Generate Icons", generationType: "activitiesIcons", imageUrlKey: "activitiesIcons", dependencies: ["character"] },
  ]},
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

const AssetPreview = ({ imageUrl, isGenerating, status, message, isLandscape, backgroundColor }: { imageUrl?: string; isGenerating: boolean, status: GenerationState['status'], message: string, isLandscape?: boolean, backgroundColor?: string }) => {
    const showLoading = isGenerating && !imageUrl;
    const showPreviousImageWhileLoading = isGenerating && imageUrl;

    // State to hold the final URL with a cache-busting param
    const [finalImageUrl, setFinalImageUrl] = useState<string | undefined>(undefined);

    // This effect runs only on the client, after hydration
    useEffect(() => {
        // Only update if imageUrl is valid and generation has finished or is starting
        if (imageUrl) {
            // Append a timestamp to bust the cache, only on the client
            setFinalImageUrl(`${imageUrl}?v=${new Date().getTime()}`);
        } else if (!isGenerating) { // Clear URL if not generating and imageUrl is empty
            setFinalImageUrl(undefined);
        }
    }, [imageUrl, isGenerating]); // Ensure imageUrl AND isGenerating are dependencies


 const AssetDisplay = useMemo(() => {
        if (finalImageUrl) {
            return (
                <div className="relative w-full h-full">
 <Image src={finalImageUrl} alt="Generated Me-Gotchi Asset" width={512} height={512} className="rounded-lg object-contain w-full h-full" />
                    {isGenerating && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
                           <div className="flex items-center space-x-2 text-foreground p-4 rounded-lg bg-background/80"><RefreshCw className="animate-spin h-5 w-5" /><p className="font-headline">Regenerating...</p></div>
                        </div>
                    )}
                </div>
            );
        } else if (isGenerating) {
            return <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 bg-accent/30 rounded-lg"><Skeleton className="h-full w-full rounded-lg" /><div className="flex items-center space-x-2 text-foreground"><RefreshCw className="animate-spin h-5 w-5" /><p className="font-headline">AI is creating magic...</p></div></div>;
        } else if (status === 'error') {
 return <div className="w-full h-full flex flex-col items-center justify-center text-destructive p-4"><AlertCircle className="h-16 w-16" /><p className="mt-4 font-semibold text-center">{message}</p></div>;
        } else {
            // Empty state
            return <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4"><Sparkles className="h-16 w-16" /><p className="mt-4 font-semibold text-center">Your generated asset will appear here</p></div>;
        }
    }, [finalImageUrl, isGenerating, status, message]);

    return (
        <div className={`w-full mx-auto bg-secondary rounded-lg border border-dashed flex items-center justify-center overflow-hidden ${isLandscape ? 'aspect-video' : 'aspect-square'}`} style={{ backgroundColor: backgroundColor || 'inherit' }}> {/* Apply background color here */}
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
    isLandscape,
    hasBeenGenerated,
    backgroundColor,
    isLocked,
    onGenerate
}: {
    title: string;
    generationType: string;
    imageUrl?: string;
    state: GenerationState;
    isGenerating: boolean;
    isLandscape: boolean;
    hasBeenGenerated: boolean;
    backgroundColor?: string;
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
        <AssetPreview imageUrl={imageUrl} isGenerating={isGenerating} isLandscape={isLandscape} backgroundColor={backgroundColor} status={state.status} message={state.message} />
    </div>
);

const ColorPickerInput = ({ field, textColor }: { field: any, textColor?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Add ref for the main container
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Dismiss if the click is outside the main container that holds both input and picker
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, inputRef]); // Depend on containerRef and inputRef

  return (
    <div className="relative" ref={containerRef}> {/* Attach the container ref */}
      <Input
        ref={inputRef}
        {...field}
        value={field.value ?? ''}
        onClick={() => setIsOpen(prev => !prev)}
        placeholder="eg: #FF0000"
 className="text-base cursor-pointer"
 style={{ backgroundColor: field.value, color: textColor || '#000000' }}
        readOnly // Prevent manual input for simplicity with the picker
      />
 {isOpen && (
        <div ref={pickerRef} className="absolute z-10 mt-2 shadow-lg">
          <HexColorPicker color={field.value || '#ffffff'} onChange={field.onChange} />
        </div> 
      )}
    </div>
  );
};

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
            <FormControl style={{ textTransform: 'uppercase' }}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
              <FormField control={control} name="favoriteColor" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Favorite Color</FormLabel>
                    <FormControl><ColorPickerInput field={field} textColor="#FFFFFF" /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

        </div>
        <FormField control={control} name="photo" render={({ field: { onChange, value, ...rest }, fieldState }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">Face Photo</FormLabel>
              <FormControl>
                <div className="relative flex items-center justify-center w-full h-full min-h-[256px]">
                  <label htmlFor="dropzone-file" className={`relative flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer bg-secondary hover:bg-accent transition-colors ${fieldState.error ? 'border-destructive' : 'border-border'}`}>
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Photo preview" width={512} height={512} className="absolute inset-0 w-full h-full object-contain rounded-lg p-2" />
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
         {/* Add Food Background Color Field */}
         <div className="mt-6">
            <FormField control={control} name="foodBackgroundColor" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Food Background Color</FormLabel>
                    <FormControl><ColorPickerInput field={field} textColor="#000000" /></FormControl>
                </FormItem>
            )} /></div>
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
         {/* Add Activities Background Color Field */}
        <div className="mt-6">
            <FormField control={control} name="activitiesBackgroundColor" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Activities Background Color</FormLabel>
                    <FormControl><ColorPickerInput field={field} textColor="#000000" /></FormControl>
                </FormItem>
            )} /></div>
    </div>
  );
};

const Step4 = ({ control }: { control: Control<OnboardingFormData> }) => {
  const { fields: environments } = useFieldArray({ control, name: 'environments' });

  const environmentPlaceholders = [
    "eg: Vibrant street in Hampstead, London, showing multiple houses in a bright summer day",
    "eg: Vibrant colorful children playroom that has toys and games and is appropriate for a 9 years old boy named Leo",
    "eg: Vibrant colorful classroom showing multiple desks",
    "eg: Vibrant colorful playground for older children that has games and fun",
  ];

  return (
    <div className="space-y-4">
        <CardDescription>Describe environments the character will normally visit.</CardDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {environments.map((item, index) => (
            <FormField
                key={item.id}
                name={`environments.${index}.explanation`}
                control={control}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-base font-semibold">Environment {index + 1}</FormLabel>
                    <FormControl>
                    <Textarea {...field} placeholder={environmentPlaceholders[index]} className="min-h-[80px] text-base" />
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
  const [showExpressionsStyleModal, setShowExpressionsStyleModal] = useState(false);
  
  const [imageUrls, setImageUrls] = useState<StepImageUrls>({});
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null);

 // State for individual environment generation statuses
  const [environmentGenerationStates, setEnvironmentGenerationStates] = useState<Record<string, EnvironmentGenerationState>>({
    environment1: { status: "idle", message: "" },
    environment2: { status: "idle", message: "" },
    environment3: { status: "idle", message: "" },
    environment4: { status: "idle", message: "" },
  });
  const [lastResult, setLastResult] = useState<GenerationState>({ status: "idle", message: "" });
  
  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(OnboardingFormSchema),
    mode: "onTouched",
    defaultValues: {
      inviteCode: inviteCode,
      step: 1,
      imageUrls: {},
      likedFoods: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })), // Initialize with empty items
      dislikedFoods: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedDrinks: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedDrinks: [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedFunActivities: [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedFunActivities: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      likedExerciseActivities: [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      dislikedExerciseActivities: [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
      environments: [...Array(4)].map(() => ({ explanation: "" })),
    },
    // Add default values for new color fields
    favoriteColor: "", // Default to empty
    foodBackgroundColor: "", // Default to empty
    activitiesBackgroundColor: "", // Default to empty
  });

  const { control, handleSubmit, watch, setError, setValue, trigger, getValues, reset } = form;

  // Effect to check for existing preferences and assets on mount
  useEffect(() => {
    const fetchExistingData = async () => {
      // Fetch preferences
      const prefsUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(inviteCode)}/preferences.json`;
      try {
        const response = await fetch(`${prefsUrl}?cache-bust=${new Date().getTime()}`);
        if (response.ok) {
          const prefsData = await response.json();
          reset({
            ...prefsData,
            likedFoods: prefsData.likedFoods || [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            dislikedFoods: prefsData.dislikedFoods || [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            likedDrinks: prefsData.likedDrinks || [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            dislikedDrinks: prefsData.dislikedDrinks || [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            likedFunActivities: prefsData.likedFunActivities || [...Array(3)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            dislikedFunActivities: prefsData.dislikedFunActivities || [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            likedExerciseActivities: prefsData.likedExerciseActivities || [...Array(2)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            dislikedExerciseActivities: prefsData.dislikedExerciseActivities || [...Array(1)].map(() => ({ name: "", addExplanation: false, explanation: "" })),
            environments: prefsData.environments || [...Array(4)].map(() => ({ explanation: "" })),
          });
            // Ensure new color fields are reset if they exist in prefsData
            if (prefsData.favoriteColor !== undefined) setValue('favoriteColor', prefsData.favoriteColor);
            if (prefsData.foodBackgroundColor !== undefined) setValue('foodBackgroundColor', prefsData.foodBackgroundColor);
            if (prefsData.activitiesBackgroundColor !== undefined) setValue('activitiesBackgroundColor', prefsData.activitiesBackgroundColor);
        } else {
          // This is not an error, it just means the user is new.
          console.log("No existing preferences.json found, starting with a fresh form.");
        }
      } catch (error) {
        // This might happen on network errors, but we don't want to block the user.
        console.warn("Could not fetch preferences.json, starting with a fresh form:", error);
      }

      // Check for existing character asset
      const filePath = `${inviteCode}/character.png`;
      const publicUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(filePath)}`;
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (response.ok) {
          setImageUrls(prev => ({ ...prev, character: publicUrl }));
        }
      } catch (error) {
        console.warn("Error checking for existing character asset:", error);
      }

      // Check for existing face atlas asset
      const faceAtlasFilePath = `${inviteCode}/face-atlas.png`;
      const faceAtlasPublicUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(faceAtlasFilePath)}`;
      try {
        const response = await fetch(faceAtlasPublicUrl, { method: 'HEAD' });
        if (response.ok) {
          setImageUrls(prev => ({ ...prev, faceAtlas: faceAtlasPublicUrl }));
        }
      } catch (error) {
        console.warn("Error checking for existing face atlas asset:", error);
      }

      // Check for existing food icons asset
      const foodIconsFilePath = `${inviteCode}/food-atlas.png`;
      const foodIconsPublicUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(foodIconsFilePath)}`;
      try {
        const response = await fetch(foodIconsPublicUrl, { method: 'HEAD' });
        if (response.ok) {
          setImageUrls(prev => ({ ...prev, foodIcons: foodIconsPublicUrl }));
        }
      } catch (error) {
        console.warn("Error checking for existing food icons asset:", error);
      }

      // Check for existing activities icons asset
      const activitiesIconsFilePath = `${inviteCode}/activities-atlas.png`;
      const activitiesIconsPublicUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(activitiesIconsFilePath)}`;
      try {
        const response = await fetch(activitiesIconsPublicUrl, { method: 'HEAD' });
        if (response.ok) {
          setImageUrls(prev => ({ ...prev, activitiesIcons: activitiesIconsPublicUrl }));
        }
      } catch (error) {
        console.warn("Error checking for existing activities icons asset:", error);
      }

      // Check for existing environment background assets
      for (let i = 1; i <= 4; i++) {
        const backgroundFilePath = `${inviteCode}/background${i}.jpg`;
        const backgroundPublicUrl = `https://storage.googleapis.com/me-gotchi.firebasestorage.app/${encodeURIComponent(backgroundFilePath)}`;
        const environmentKey = `environment${i}` as keyof StepImageUrls;
        try {
          const response = await fetch(backgroundPublicUrl, { method: 'HEAD' });
          if (response.ok) {
            setImageUrls(prev => ({ ...prev, [environmentKey]: backgroundPublicUrl }));
          }
        } catch (error) {
          console.warn(`Error checking for existing environment ${i} asset:`, error);
        }
      }


    };
    fetchExistingData();
  }, [inviteCode, reset]);

  useEffect(() => {
      setValue('step', currentStep, { shouldValidate: true });
      setValue('imageUrls', imageUrls);
  }, [currentStep, setValue, imageUrls]); // Removed environmentGenerationStates from dependencies
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const generateEnvironmentAsset = async (generationType: string, formValues: OnboardingFormData, imageUrls: StepImageUrls) => {
 setEnvironmentGenerationStates(prev => ({
      ...prev,
      [generationType]: { status: "generating", message: "Generating..." }
    }));
 try {
 const functionsInstance = getFunctions(app, 'us-central1');
      const generateFunction = httpsCallable(functionsInstance, 'generateAssetEnvironment', { timeout: 300000 });

      const environmentNumber = parseInt(generationType.replace('environment', ''), 10);
      if (isNaN(environmentNumber) || environmentNumber < 1 || environmentNumber > 4) {
 setEnvironmentGenerationStates(prev => ({ ...prev, [generationType]: { status: 'error', message: `Invalid environment generation type: ${generationType}` } }));
 return;
      }

      const payload = {
 inviteCode: formValues.inviteCode,
 environments: formValues.environments,
 environmentNumber: environmentNumber,
      };

      const result = await generateFunction(payload) as { data: { assetUrl?: string, success?: boolean, message?: string } };

 setEnvironmentGenerationStates(prev => ({ ...prev, [generationType]: { status: result.data.success ? 'success' : 'error', message: result.data.message || (result.data.success ? 'Environment generated successfully!' : 'Failed to generate environment.'), imageUrl: result.data.assetUrl } }));
 if (result.data.success && result.data.assetUrl) {
 setImageUrls(prev => ({ ...prev, [generationType]: result.data.assetUrl! }));
      }
    } catch (error) {
 console.error("Firebase environment generation error:", error);
 const functionsError = error as HttpsCallableError;
 const errorMessage = `Code: ${functionsError.code}. Message: ${functionsError.message}. Details: ${JSON.stringify(functionsError.details)}`;
 setEnvironmentGenerationStates(prev => ({ ...prev, [generationType]: { status: 'error', message: errorMessage } }));
    }
  };
  useEffect(() => {
      // Handle results for non-environment generations
    if (!lastResult.generationType?.includes('environment') && lastResult.status !== "idle") {
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
            setImageUrls(prev => ({ ...prev, [generationType]: lastResult.imageUrl! }));

            if (generationType === 'character') {
                setValue("imageUrl", lastResult.imageUrl);
            }
        }
    }
  }, [lastResult, toast, setValue]);

 // New effect to handle environment generation states
 useEffect(() => {
    Object.entries(environmentGenerationStates).forEach(([type, state]) => {
      if (state.status === 'error') {
        toast({
          variant: "destructive",
          title: `Environment ${type.replace('environment', '')} Generation Failed`,
          description: state.message,
        });
      } else if (state.status === 'success') {
        // Optional: success toast for environments, might be too many toasts if generating all 4
        // toast({
        //   title: `Environment ${type.replace('environment', '')} Generated`,
        //   description: state.message,
        // });
      }
    });
  }, [environmentGenerationStates, toast]);


  // Keep this useEffect for the general lastResult state (non-environment)
 useEffect(() => {
    if (!lastResult.generationType?.includes('environment') && lastResult.status !== "idle") {
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
      }
    }
 }, [lastResult, toast, setValue]);


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
  
  const onGenerate = async (generationType: string, expressionsStyle?: string) => {
    const stepConfig = STEPS.find(s => s.id === currentStep);

    // If generating expressions and no style is provided, open the modal
    if (generationType === 'expressions' && !expressionsStyle) {
        const isValid = await trigger(stepConfig?.fields as any);
        if (!isValid) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please fill out all required fields for this step before selecting an expressions style.",
            });
            return;
        }
        setShowExpressionsStyleModal(true);
        return; // Stop the generation process for now, wait for modal selection
    }
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

 // For environments, update the state for the specific environment
    if (generationType.includes('environment')) {
        setEnvironmentGenerationStates(prev => ({
            ...prev,
            [generationType]: { status: "generating", message: "Generating..." }
        }));
    } else {
        setActiveGeneration(generationType);
    }
    
    try {
        const functionsInstance = getFunctions(app, 'us-central1');
        // Default to character generation function, update below if generationType is expressions
        let generateFunction = httpsCallable(functionsInstance, 'generateAssetAppearanceCharacter', { timeout: 300000 });
        const currentValues = getValues();
        
        let photoDataUri: string | undefined;
        if (currentValues.photo instanceof File && currentValues.photo.size > 0) {
            photoDataUri = await fileToDataURI(currentValues.photo);
        }

        let payload: any = {
            ...currentValues,
            generationType,
            photoDataUri,
        };
        
        // If generating expressions, use the expressions function and pass the character image URL
        if (generationType === 'expressions') {
             generateFunction = httpsCallable(functionsInstance, 'generateAssetAppearanceExpressions', { timeout: 300000 });
             if (!imageUrls.character) {
                  throw new Error("Character image is required to generate expressions.");
             }
             // Add the character image URL to the payload
             payload.characterImageUrl = imageUrls.character;

             // Add the selected expressions style if available
             if (expressionsStyle) {
                 payload.expressionsStyle = expressionsStyle;
             }
        }
        
        // If generating food icons, use the foodIcons function
        if (generationType === 'foodIcons') {
             generateFunction = httpsCallable(functionsInstance, 'generateAssetFoodIcons', { timeout: 300000 });
             if (!imageUrls.character) {
                  throw new Error("Character image is required to generate food icons.");
             }
             // Add the character image URL and food/drink preferences to the payload
             payload = {
                inviteCode: currentValues.inviteCode,
                characterImageUrl: imageUrls.character,
                likedFoods: currentValues.likedFoods,
                dislikedFoods: currentValues.dislikedFoods,
                likedDrinks: currentValues.likedDrinks,
                dislikedDrinks: currentValues.dislikedDrinks,
 foodBackgroundColor: currentValues.foodBackgroundColor, // Add background color
             }
        }

        // If generating activities icons, use the activitiesIcons function
        if (generationType === 'activitiesIcons') {
             generateFunction = httpsCallable(functionsInstance, 'generateAssetActivitiesIcons', { timeout: 300000 });
             if (!imageUrls.character) {
                  throw new Error("Character image is required to generate activities icons.");
             }
             // Add the character image URL and activity preferences to the payload
             payload = {
                inviteCode: currentValues.inviteCode,
                characterImageUrl: imageUrls.character,
                likedFunActivities: currentValues.likedFunActivities,
                dislikedFunActivities: currentValues.dislikedFunActivities,
                likedExerciseActivities: currentValues.likedExerciseActivities,
                dislikedExerciseActivities: currentValues.dislikedExerciseActivities,
 activitiesBackgroundColor: currentValues.activitiesBackgroundColor, // Add background color
             }
        }
        
        // If generating environments, use the generateAssetEnvironment function
        if (generationType.includes('environment')) {
             generateFunction = httpsCallable(functionsInstance, 'generateAssetEnvironment', { timeout: 300000 });
             // Extract environment number from generationType (e.g., "environment1" -> 1)
             const environmentNumber = parseInt(generationType.replace('environment', ''), 10);
             if (isNaN(environmentNumber) || environmentNumber < 1 || environmentNumber > 4) {
                 throw new Error(`Invalid environment generation type: ${generationType}`);
             }
             payload = {
                inviteCode: currentValues.inviteCode,
                characterImageUrl: imageUrls.character,
                environments: currentValues.environments, // Pass the entire environments array
                environmentNumber: environmentNumber,
             }
        }


        const result = await generateFunction(payload) as { data: { assetUrl?: string, success?: boolean, message?: string } };
        
 if (generationType.includes('environment')) {
 setEnvironmentGenerationStates(prev => ({
                ...prev,
                [generationType]: {
                    status: result.data.success ? 'success' : 'error',
                    message: result.data.message || (result.data.success ? 'Environment generated successfully!' : 'Failed to generate environment.'),
                    imageUrl: result.data.assetUrl,
                    generationType: generationType,
                }
 }));
 if (result.data.success && result.data.assetUrl) {
 setImageUrls(prev => ({ ...prev, [generationType]: result.data.assetUrl! }));
 }
 } else {
 setLastResult({
            status: 'success',
            message: 'Asset generated successfully!',
            imageUrl: result.data.assetUrl,
            generationType: generationType,
        });
 }
    } catch (error) {
        console.error("Full Firebase function call error:", error);
        const functionsError = error as HttpsCallableError;
        const errorMessage = `Code: ${functionsError.code}. Message: ${functionsError.message}. Details: ${JSON.stringify(functionsError.details)}`;
        
        setLastResult({
            status: 'error',
            message: errorMessage,
            generationType: generationType,
        });
 if (generationType.includes('environment')) {
 setEnvironmentGenerationStates(prev => ({
                ...prev,
                [generationType]: {
                    status: 'error',
                    message: errorMessage,
                    generationType: generationType,
                }
 }));
 }
    }
  }
  
  const stepConfig = STEPS.find(s => s.id === currentStep);
  const isStepComplete = useMemo(() => {
    if (!stepConfig) return false;
    if (currentStep === 1) {
        return !!imageUrls.character || !!imageUrls.faceAtlas; 
    }
    return stepConfig.generations.every(g => !!imageUrls[g.imageUrlKey as keyof StepImageUrls]);
  }, [currentStep, stepConfig, imageUrls]);
  
  const renderGenerationUnits = (step: number) => {
      const config = STEPS.find(s => s.id === step);
       const formValues = watch(); // Watch the entire form for color values

      if (!config) return null;

      return config.generations.map(genConfig => {
          const isStep4 = step === 4;

          const genType = genConfig.generationType;
          let isGenerating;
 if (isStep4) {
              isGenerating = environmentGenerationStates[genType]?.status === 'generating';
 } else {
              isGenerating = activeGeneration === genType;
 }
          let hasBeenGenerated = !!imageUrls[genConfig.imageUrlKey];
          // Special case for expressions generation in Step 1:
          // It's considered "generated" if the faceAtlas exists, even ifimageUrlKey is 'expressions'
          if (step === 1 && genType === 'expressions') {
              hasBeenGenerated = !!imageUrls.faceAtlas;
          }

          // Special case for foodIcons generation in Step 2:
          if (step === 2 && genType === 'foodIcons') {
            hasBeenGenerated = !!imageUrls.foodIcons;
          }
          
          // Special case for activitiesIcons generation in Step 3:
           if (step === 3 && genType === 'activitiesIcons') {
            hasBeenGenerated = !!imageUrls.activitiesIcons;
          }
           // Special case for environment generation in Step 4:
           if (step === 4 && genType.includes('environment')) {
             hasBeenGenerated = !!imageUrls[genConfig.imageUrlKey];
           }


          let currentImageUrl = (step === 1 && genType === 'expressions' && imageUrls.faceAtlas) ? imageUrls.faceAtlas :
                                (step === 2 && genType === 'foodIcons' && imageUrls.foodIcons) ? imageUrls.foodIcons :
                                (step === 3 && genType === 'activitiesIcons' && imageUrls.activitiesIcons) ? imageUrls.activitiesIcons : imageUrls[genConfig.imageUrlKey];

          const resultForThisUnit = isStep4
 ? environmentGenerationStates[genType] || { status: 'idle' as const, message: '' }
 : lastResult.generationType === genType ? lastResult : { status: 'idle' as const, message: '' };
          
          const dependenciesMet = genConfig.dependencies?.every(dep => !!imageUrls[dep as keyof StepImageUrls]) ?? true;

          let backgroundColor = undefined;
            if (step === 2 && genType === 'foodIcons') {
                backgroundColor = formValues.foodBackgroundColor;
            } else if (step === 3 && genType === 'activitiesIcons') {
                backgroundColor = formValues.activitiesBackgroundColor;
            }


          const isLocked = !dependenciesMet;
          return (
            <GenerationUnit // Removed the direct wrapper div here
              key={genType}
              title={genConfig.title}
              generationType={genType}
              imageUrl={currentImageUrl}
              state={resultForThisUnit}
              isGenerating={isGenerating}
              hasBeenGenerated={hasBeenGenerated}
              isLocked={isLocked}
              onGenerate={onGenerate}
              backgroundColor={backgroundColor}
              isLandscape={isStep4}
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
      <Dialog open={showExpressionsStyleModal} onOpenChange={setShowExpressionsStyleModal}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Choose an Expressions Style</DialogTitle>
                <DialogDescription>Select the style you want for your character's expressions.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                {["3D", "2.5D", "Anime", "Comic"].map(style => (
                    <button
                        key={style}
                        className="flex flex-col items-center space-y-2 border rounded-md p-2 hover:bg-accent transition-colors"
                        onClick={() => {
                            setShowExpressionsStyleModal(false);
                            // Trigger the generation function with the selected style
                            onGenerate('expressions', style);
                        }}
                    >
                         {/* Replace with actual placeholder images */}
                        <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                             {/* Placeholder Image */}
                             <Image
                                src={`/placeholders/${style.toLowerCase().replace('.', '')}.png`} // Example placeholder path
                                alt={`${style} Style Preview`}
                                width={150}
                                height={150}
                                className="object-contain"
                            />
                        </div>
                       <span className="text-sm font-semibold">{style}</span>
                    </button>
                ))}
            </div>
             <DialogFooter>
                 {/* Optional: Add a close button */}
                 {/* <Button variant="outline" onClick={() => setShowExpressionsStyleModal(false)}>
                     Cancel
                 </Button> */}
             </DialogFooter>
        </DialogContent>
    </Dialog>
    </div>
  );
}
