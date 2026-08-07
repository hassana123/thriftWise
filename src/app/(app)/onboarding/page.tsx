"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Landmark,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEFAULT_WORKING_DAYS, FULL_DAY_LABELS, STANDARD_PLANS } from "@/domain/constants";

const memberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
});

const formSchema = z.object({
  name: z.string().trim().min(3, "Give the vacation a name (min 3 characters)"),
  startDate: z.string().min(1, "Pick a start date"),
  vacationDate: z.string().min(1, "Pick the vacation date"),
  workingDays: z.array(z.number()).min(1, "Select at least one contribution day"),
  defaultDailyAmount: z.coerce.number().min(50, "Minimum daily amount is ₦50"),
  bank: z.string().trim().min(2, "Bank name is required"),
  accountName: z.string().trim().min(2, "Account name is required"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Enter a valid account number (6–10 digits)"),
  members: z.array(memberSchema).min(1, "Add at least yourself"),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

type FormReturn = UseFormReturn<FormInput, undefined, FormValues>;

const STEPS: { key: keyof FormValues; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "name", title: "Name your vacation", subtitle: "What are you saving toward?", icon: Plane },
  { key: "startDate", title: "When do contributions start?", subtitle: "We'll generate weeks automatically.", icon: CalendarDays },
  { key: "vacationDate", title: "When is the vacation?", subtitle: "Savings run until this date.", icon: Sparkles },
  { key: "workingDays", title: "Which days can you save?", subtitle: "Choose your contribution days.", icon: CalendarDays },
  { key: "defaultDailyAmount", title: "Default daily contribution", subtitle: "Each member can customize their plan.", icon: Banknote },
  { key: "bank", title: "Destination account", subtitle: "Where weekly contributions are sent.", icon: Landmark },
  { key: "members", title: "Invite your family", subtitle: "Add the people saving together.", icon: Users },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { createThrift, state } = useThrift();
  const { member, user } = useAuth();

  const [step, setStep] = React.useState(0);
  const [completed, setCompleted] = React.useState(false);
  const justCreated = React.useRef(false);

  // A signed-in user with existing data shouldn't be onboarding — this happens
  // when a returning user lands here via a stale refresh or after a slow load.
  // Skip the redirect when we just created the thrift so the celebration shows.
  React.useEffect(() => {
    if (state && user && !justCreated.current) {
      router.replace("/dashboard");
    }
  }, [state, user, router]);

  const form = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "December Family Vacation",
      startDate: "",
      vacationDate: "",
      workingDays: DEFAULT_WORKING_DAYS,
      defaultDailyAmount: 200,
      bank: "OPay",
      accountName: user?.displayName ?? member?.name ?? "",
      accountNumber: "",
      members: [
        {
          name: user?.displayName ?? member?.name ?? "",
          email: user?.email ?? "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "members",
  });

  const watchWorkingDays = form.watch("workingDays");
  const watchDaily = Number(form.watch("defaultDailyAmount")) || 0;

  async function validateStep(index: number): Promise<boolean> {
    const stepField = STEPS[index].key;
    const fieldsForStep: (keyof FormValues)[] =
      stepField === "bank"
        ? ["bank", "accountName", "accountNumber"]
        : stepField === "members"
          ? ["members"]
          : [stepField];
    const result = await form.trigger(fieldsForStep as (keyof FormValues)[]);
    return result;
  }

  async function handleNext() {
    if (await validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  async function handleSubmit() {
    if (step < STEPS.length - 1) {
      await handleNext();
      return;
    }
    if (await validateStep(step)) {
      justCreated.current = true;
      const values = form.getValues();
      createThrift({
        name: values.name,
        startDate: values.startDate,
        vacationDate: values.vacationDate,
        workingDays: values.workingDays,
        defaultDailyAmount: Number(values.defaultDailyAmount),
        paymentAccount: {
          bank: values.bank,
          accountName: values.accountName,
          accountNumber: values.accountNumber,
        },
        members: values.members.map((m) => ({
          name: m.name,
          email: m.email || undefined,
          role: "member" as const,
        })),
        creatorName: values.members[0]?.name ?? "Admin",
        creatorEmail: values.members[0]?.email ?? "",
      });
      setCompleted(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    }
  }

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-xl flex-col justify-center py-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-float">
        <CardContent className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                  className="flex size-20 items-center justify-center rounded-full bg-primary/15"
                >
                  <Check className="size-10 text-primary" strokeWidth={2.5} />
                </motion.div>
                <h2 className="text-2xl font-bold">Your thrift is live!</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Weeks have been generated automatically from your start date. Your family is ready to save.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10">
                    <current.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{current.title}</h2>
                    <p className="text-sm text-muted-foreground">{current.subtitle}</p>
                  </div>
                </div>

                {step === 0 && <NameStep form={form} />}
                {step === 1 && <DateStep label="Contribution start date" field="startDate" form={form} />}
                {step === 2 && <DateStep label="Vacation date" field="vacationDate" form={form} />}
                {step === 3 && <WorkingDaysStep form={form} workingDays={watchWorkingDays} />}
                {step === 4 && <AmountStep form={form} daily={watchDaily} />}
                {step === 5 && <AccountStep form={form} />}
                {step === 6 && (
                  <MembersStep
                    fields={fields}
                    append={append}
                    remove={remove}
                    register={form.register}
                  />
                )}

                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="gap-2"
                  >
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button onClick={handleSubmit} className="gap-2 px-6">
                    {step === STEPS.length - 1 ? (
                      <>
                        Create thrift <Check className="size-4" />
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function NameStep({ form }: { form: FormReturn }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="name">Vacation name</Label>
      <Input
        id="name"
        placeholder="e.g. December Family Vacation"
        className="h-12 text-lg font-semibold"
        {...form.register("name")}
        autoFocus
      />
      <FieldError message={form.formState.errors.name?.message} />
      <p className="text-xs text-muted-foreground">
        This is the goal everyone is saving toward.
      </p>
    </div>
  );
}

function DateStep({
  label,
  field,
  form,
}: {
  label: string;
  field: "startDate" | "vacationDate";
  form: FormReturn;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type="date"
        className="h-12"
        {...form.register(field)}
        autoFocus
      />
      <FieldError message={form.formState.errors[field]?.message} />
      <p className="text-xs text-muted-foreground">
        {field === "startDate"
          ? "Contribution weeks are generated automatically from this date."
          : "Savings continue until this date. Week generation stops here."}
      </p>
    </div>
  );
}

function WorkingDaysStep({
  form,
  workingDays,
}: {
  form: FormReturn;
  workingDays: number[];
}) {
  const toggle = (dow: number) => {
    const next = workingDays.includes(dow)
      ? workingDays.filter((d) => d !== dow)
      : [...workingDays, dow].sort();
    form.setValue("workingDays", next, { shouldValidate: true });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
          const selected = workingDays.includes(dow);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggle(dow)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-sm font-medium transition-all",
                selected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-lg font-bold">{FULL_DAY_LABELS[dow - 1][0]}</span>
              <span className="text-xs">{FULL_DAY_LABELS[dow - 1]}</span>
              {selected ? <Check className="size-4" strokeWidth={3} /> : null}
            </button>
          );
        })}
      </div>
      <FieldError message={form.formState.errors.workingDays?.message} />
      <p className="text-xs text-muted-foreground">
        Weekly targets are calculated from these days. Default is Monday–Friday.
      </p>
    </div>
  );
}

function AmountStep({
  form,
  daily,
}: {
  form: FormReturn;
  daily: number;
}) {
  const plans = [STANDARD_PLANS["one-hand"], STANDARD_PLANS["one-half-hand"], STANDARD_PLANS["two-hands"]];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {plans.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => form.setValue("defaultDailyAmount", p.dailyAmount, { shouldValidate: true })}
            className={cn(
              "rounded-2xl border-2 p-3 text-center transition-all",
              daily === p.dailyAmount ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <p className="text-base font-bold">{formatMoney(p.dailyAmount)}</p>
            <p className="text-[11px] text-muted-foreground">/day</p>
            <p className="mt-1 text-[11px] font-semibold text-primary">{formatMoney(p.weeklyAmount)}/wk</p>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="daily">Custom daily amount</Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₦</span>
          <Input
            id="daily"
            type="number"
            className="h-12 pl-9 text-lg font-bold"
            {...form.register("defaultDailyAmount")}
          />
        </div>
        <FieldError message={form.formState.errors.defaultDailyAmount?.message} />
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Weekly (5 days)</p>
          <p className="text-xl font-bold">{formatMoney(daily * 5)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Monthly</p>
          <p className="text-xl font-bold text-primary">{formatMoney(daily * 20)}</p>
        </div>
      </div>
    </div>
  );
}

function AccountStep({ form }: { form: FormReturn }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bank">Bank</Label>
        <Input id="bank" placeholder="e.g. OPay, Moniepoint, GTBank" {...form.register("bank")} autoFocus />
        <FieldError message={form.formState.errors.bank?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountName">Account name</Label>
        <Input id="accountName" placeholder="e.g. Hassana Abdullahi" {...form.register("accountName")} />
        <FieldError message={form.formState.errors.accountName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountNumber">Account number</Label>
        <Input
          id="accountNumber"
          inputMode="numeric"
          placeholder="e.g. 8102920194"
          className="font-mono tracking-widest"
          {...form.register("accountNumber")}
        />
        <FieldError message={form.formState.errors.accountNumber?.message} />
      </div>
    </div>
  );
}

function MembersStep({
  fields,
  append,
  remove,
  register,
}: {
  fields: { id: string }[];
  append: (value: { name: string; email?: string }) => void;
  remove: (index: number) => void;
  register: FormReturn["register"];
}) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <motion.div
          key={field.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-2xl border p-3"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
            <UserPlus className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              placeholder="Full name"
              className="h-10"
              {...register(`members.${index}.name`)}
            />
            <Input
              placeholder="Email (optional)"
              type="email"
              className="h-10"
              {...register(`members.${index}.email`)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
            disabled={fields.length === 1}
            aria-label="Remove member"
          >
            <Trash2 className="size-4" />
          </Button>
        </motion.div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => append({ name: "", email: "" })}
      >
        <Plus className="size-4" /> Add member
      </Button>
      <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="shrink-0">
          Admin
        </Badge>
        The first member is the thrift admin with full control.
      </div>
      <Separator />
      <p className="text-xs text-muted-foreground">
        Members can pick their own contribution plan (One Hand, One & Half, Two Hands, or Custom) after joining.
      </p>
    </div>
  );
}
