"use client";

import React, { useEffect, useState, useMemo, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useForm, useFieldArray, Control, UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { generateMeGotchiAsset, type FormState } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
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
const OnboardingFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(11, "Max 11 characters."),
  gender: z.enum(["male", "female"], { required_error: "Please select a gender." }),
  age: z.coerce.number({invalid_type_error: "Age is required"}).min(1, "Must be at least 1.").max(120, "Must be 120 or less."),
  photo: z.any().refine((file) => file instanceof File && file.size > 0, "A photo is required.")
    .refine((file) => file instanceof File && file.size < 4 * 1024 * 1024, "Photo must be less than 4MB.")
    .refine((file) => file instanceof File && ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Only .jpg, .png, and .webp formats are supported."),
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
});
type OnboardingFormData = z.infer<typeof OnboardingFormSchema>;

const STEPS = [
  { id: 1, title: "Your Likeness", fields: ["firstName", "gender", "age", "photo"] },
  { id: 2, title: "Food Preferences", fields: ["likedFoods", "dislikedFoods", "likedDrinks", "dislikedDrinks"] },
  { id: 3, title: "Activity Preferences", fields: ["likedFunActivities", "dislikedFunActivities", "likedExerciseActivities", "dislikedExerciseActivities"] },
  { id: 4, title: "Environments & Generation", fields: ["environments"] },
];

function SubmitButton({ isSuccess }: { isSuccess: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full font-bold" disabled={pending || isSuccess}>
      {pending ? (
        <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
      ) : isSuccess ? (
        <><CheckCircle className="mr-2 h-4 w-4" /> Done!</>
      ) : (
        <><Wand2 className="mr-2 h-4 w-4" /> Generate my Me-Gotchi!</>
      )}
    </Button>
  );
}

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
    <div className="space-y-2 p-3 border rounded-md">
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
    <Card className="shadow-lg">
      <CardHeader><CardTitle className="font-headline text-2xl">Step 1: Your Likeness</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">First Name</FormLabel>
              <FormControl>
                <Input placeholder="Your first name" {...field} className="text-base"/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-semibold">Gender</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-semibold">Age</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 25" {...field} className="text-base"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="photo"
          render={({ field: { onChange, value, ...rest }, fieldState }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">Your Photo</FormLabel>
              <FormControl>
                <div className="relative flex items-center justify-center w-full">
                  <label
                    htmlFor="dropzone-file"
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-secondary hover:bg-accent transition-colors ${
                      fieldState.invalid ? 'border-destructive' : 'border-border'
                    }`}
                  >
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Photo preview" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG or WEBP (MAX. 4MB)</p>
                      </div>
                    )}
                    <input
                      id="dropzone-file"
                      type="file"
                      className="hidden"
                      onChange={(e) => onChange(e.target.files?.[0])}
                      {...rest}
                      accept="image/png, image/jpeg, image/webp"
                    />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};
const Step2 = ({ control, watch }: { control: Control<OnboardingFormData>, watch: UseFormWatch<OnboardingFormData>}) => {
    const { fields: likedFoods } = useFieldArray({ control, name: 'likedFoods' });
    const { fields: dislikedFoods } = useFieldArray({ control, name: 'dislikedFoods' });
    const { fields: likedDrinks } = useFieldArray({ control, name: 'likedDrinks' });
    const { fields: dislikedDrinks } = useFieldArray({ control, name: 'dislikedDrinks' });
  return (
    <Card className="shadow-lg">
      <CardHeader><CardTitle className="font-headline text-2xl">Step 2: Food Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h3 className="font-semibold text-lg mb-2">Foods You Like (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {likedFoods.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedFoods" placeholderName="PIZZA" placeholderDescription="A single slice of pizza with pepperoni on top" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Foods You Dislike (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dislikedFoods.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedFoods" placeholderName="PIZZA" placeholderDescription="A single slice of pizza with pepperoni on top" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Drinks You Like (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedDrinks.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedDrinks" placeholderName="APPLE JUICE" placeholderDescription="A glass of apple juice without any labels" />)}
            </div>
        </div>
         <div>
            <h3 className="font-semibold text-lg mb-2">Drink You Dislike (1)</h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                {dislikedDrinks.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedDrinks" placeholderName="APPLE JUICE" placeholderDescription="A glass of apple juice without any labels" />)}
            </div>
        </div>
      </CardContent>
    </Card>
  );
};
const Step3 = ({ control, watch }: { control: Control<OnboardingFormData>, watch: UseFormWatch<OnboardingFormData> }) => {
    const { fields: likedFun } = useFieldArray({ control, name: 'likedFunActivities' });
    const { fields: dislikedFun } = useFieldArray({ control, name: 'dislikedFunActivities' });
    const { fields: likedExercise } = useFieldArray({ control, name: 'likedExerciseActivities' });
    const { fields: dislikedExercise } = useFieldArray({ control, name: 'dislikedExerciseActivities' });
  return (
    <Card className="shadow-lg">
      <CardHeader><CardTitle className="font-headline text-2xl">Step 3: Activity Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h3 className="font-semibold text-lg mb-2">Fun Activities You Like (3)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {likedFun.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedFunActivities" placeholderName="PLAYSTATION" placeholderDescription="A white ps5 console standing upright" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Fun Activities You Dislike (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dislikedFun.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedFunActivities" placeholderName="PLAYSTATION" placeholderDescription="A white ps5 console standing upright" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Exercise You Like (2)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {likedExercise.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="likedExerciseActivities" placeholderName="FOOTBALL" placeholderDescription="A soccer ball" />)}
            </div>
        </div>
        <div>
            <h3 className="font-semibold text-lg mb-2">Exercise You Dislike (1)</h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                {dislikedExercise.map((item, index) => <PreferenceItem key={item.id} {...{control, watch, index}} name="dislikedExerciseActivities" placeholderName="FOOTBALL" placeholderDescription="A soccer ball" />)}
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Step4 = ({ control, state }: { control: Control<OnboardingFormData>, state: FormState }) => {
  const { fields: environments } = useFieldArray({ control, name: 'environments' });
  const { pending } = useFormStatus();

  const AssetPreview = useMemo(() => {
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
  }, [state, pending]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Step 4: Environments</CardTitle>
            <CardDescription>Describe 4 environments the person is normally found in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {environments.map((item, index) => (
               <FormField
                key={item.id}
                control={control}
                name={`environments.${index}.explanation`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Environment {index + 1}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="vibrant colorful children playroom that has toys and games and is appropriate for a 9 years old boy named Leo" className="min-h-[80px] text-base" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Generate Asset</CardTitle>
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
  );
};


export function OnboardingForm({ inviteCode }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const initialState: FormState = { status: "idle", message: "" };
  const [state, formAction] = useActionState(generateMeGotchiAsset, initialState);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(OnboardingFormSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      gender: undefined,
      age: '',
      photo: undefined,
      inviteCode: inviteCode,
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

  const { control, handleSubmit, trigger, watch } = form;

  useEffect(() => {
    if (state.status === "error") {
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: state.message || "Please check the form for errors.",
      });
      // This is a bit of a hack to get server errors to show up on the client
      if (state.validationErrors) {
        Object.entries(state.validationErrors).forEach(([field, error]) => {
           form.setError(field as any, { type: 'server', message: (error as any)._errors[0]});
        });
      }
    }
    if (state.status === "success") {
      toast({ title: "Success!", description: state.message });
    }
  }, [state, toast, form]);

  const handleNext = async () => {
    const fields = STEPS[currentStep - 1].fields;
    const output = await trigger(fields as any, { shouldFocus: true });
    if (!output) return;
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevious = () => setCurrentStep((prev) => prev - 1);

  return (
    <div>
      <div className="mb-8 space-y-2">
        <Progress value={currentStep * 25} className="w-full" />
        <p className="text-center text-sm text-muted-foreground font-medium">{`Step ${currentStep} of 4: ${STEPS[currentStep-1].title}`}</p>
      </div>
       <Form {...form}>
        <form ref={formRef} action={formAction} onSubmit={handleSubmit(() => formAction(new FormData(formRef.current!)))} className="space-y-8">
            <input type="hidden" name="inviteCode" value={inviteCode} />

            <div className={currentStep === 1 ? 'block' : 'hidden'}><Step1 control={control} watch={watch} /></div>
            <div className={currentStep === 2 ? 'block' : 'hidden'}><Step2 control={control} watch={watch} /></div>
            <div className={currentStep === 3 ? 'block' : 'hidden'}><Step3 control={control} watch={watch} /></div>
            <div className={currentStep === 4 ? 'block' : 'hidden'}><Step4 control={control} state={state} /></div>

            <div className="mt-8 flex items-center justify-between">
                <Button type="button" variant="outline" onClick={handlePrevious} className={currentStep === 1 ? 'invisible' : 'visible'}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                {currentStep < 4 && (
                    <Button type="button" size="lg" onClick={handleNext}>
                        Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
        </form>
      </Form>
    </div>
  );
}
