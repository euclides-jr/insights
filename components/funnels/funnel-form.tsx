'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

type ApplicationOption = {
  id: string;
  name: string;
};

type StepRow = {
  id: string;
  eventName: string;
};

type InitialFunnel = {
  id: string;
  applicationId: string;
  name: string;
  description: string | null;
  steps: Array<{
    id: string;
    eventName: string;
  }>;
};

export function FunnelForm({
  applications,
  onSuccess,
  initialFunnel,
}: {
  applications: ApplicationOption[];
  onSuccess: () => void;
  initialFunnel?: InitialFunnel;
}) {
  const router = useRouter();
  const [applicationId, setApplicationId] = useState(
    initialFunnel?.applicationId ?? applications[0]?.id ?? '',
  );
  const [name, setName] = useState(initialFunnel?.name ?? '');
  const [description, setDescription] = useState(
    initialFunnel?.description ?? '',
  );
  const [steps, setSteps] = useState<StepRow[]>(
    initialFunnel?.steps.map((step) => ({
      id: step.id,
      eventName: step.eventName,
    })) ?? [
      { id: crypto.randomUUID(), eventName: '' },
      { id: crypto.randomUUID(), eventName: '' },
    ],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(initialFunnel);

  function updateStep(id: string, eventName: string) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, eventName } : step)),
    );
  }

  function addStep() {
    if (steps.length >= 10) return;
    setSteps((current) => [
      ...current,
      { id: crypto.randomUUID(), eventName: '' },
    ]);
  }

  function removeStep(id: string) {
    if (steps.length <= 2) return;
    setSteps((current) => current.filter((step) => step.id !== id));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        initialFunnel ? `/api/funnels/${initialFunnel.id}` : '/api/funnels',
        {
          method: initialFunnel ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            applicationId,
            name,
            description: description || undefined,
            steps: steps.map((step) => ({
              eventName: step.eventName.trim(),
            })),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to ${initialFunnel ? 'update' : 'create'} funnel`,
        );
      }

      router.refresh();
      onSuccess();
      if (!initialFunnel) {
        setName('');
        setDescription('');
        setSteps([
          { id: crypto.randomUUID(), eventName: '' },
          { id: crypto.randomUUID(), eventName: '' },
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${initialFunnel ? 'update' : 'create'} funnel`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#0A0A0A]">
          Application
        </label>
        <select
          className="h-10 w-full rounded-md border border-[#E8E8E8] bg-white px-3 py-2 text-sm"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          disabled={isSubmitting}
        >
          {applications.map((application) => (
            <option key={application.id} value={application.id}>
              {application.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Funnel Name"
        placeholder="Signup Activation"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isSubmitting}
        required
        error={error ?? undefined}
      />

      <Input
        label="Description"
        placeholder="Track conversion from signup to purchase"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isSubmitting}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#0A0A0A]">Steps</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addStep}
            disabled={isSubmitting || steps.length >= 10}
          >
            + Add Step
          </Button>
        </div>

        {steps.map((step, index) => (
          <div key={step.id} className="flex items-end gap-3">
            <div className="w-12 text-sm text-[#7A7A7A]">#{index + 1}</div>
            <div className="flex-1">
              <Input
                label={index === 0 ? 'Event Name' : undefined}
                placeholder={index === 0 ? 'signup' : 'button_click'}
                value={step.eventName}
                onChange={(e) => updateStep(step.id, e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeStep(step.id)}
              disabled={isSubmitting || steps.length <= 2}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditing
              ? 'Saving…'
              : 'Creating…'
            : isEditing
              ? 'Save Changes'
              : 'Create Funnel'}
        </Button>
      </DialogFooter>
    </form>
  );
}
