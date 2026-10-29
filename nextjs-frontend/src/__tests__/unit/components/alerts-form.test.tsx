import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsForm } from '@/components/alerts/alerts-form';

const CATEGORIES = [
  { slug: 'beauty', name: 'Beauty & skincare' },
  { slug: 'food-drink', name: 'Food & drink' },
  { slug: 'pets', name: 'Pets' },
];

const DEMO_PANEL = /alerts aren.t live yet/i;

function setup() {
  const user = userEvent.setup();
  render(<AlertsForm categories={CATEGORIES} />);
  return {
    user,
    email: () => screen.getByLabelText(/email address/i),
    consent: () => screen.getByRole('checkbox', { name: /i agree to receive freebie emails/i }),
    submit: () => screen.getByRole('button', { name: /send me free alerts/i }),
  };
}

describe('AlertsForm', () => {
  it('shows an error and no demo panel for an invalid email', async () => {
    const form = setup();
    await form.user.type(form.email(), 'not-an-email');
    await form.user.click(screen.getByLabelText('Beauty & skincare'));
    await form.user.click(form.consent());

    await form.user.click(form.submit());

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(form.email()).toHaveAttribute('aria-invalid', 'true');
    expect(form.email()).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.queryByText(DEMO_PANEL)).toBeNull();
  });

  it('asks for at least one category before accepting the form', async () => {
    const form = setup();
    await form.user.type(form.email(), 'sam@example.com');
    await form.user.click(form.consent());

    await form.user.click(form.submit());

    expect(await screen.findByText('Choose at least one category.')).toBeInTheDocument();
    expect(screen.queryByText(DEMO_PANEL)).toBeNull();
  });

  it('requires consent before accepting the form', async () => {
    const form = setup();
    await form.user.type(form.email(), 'sam@example.com');
    await form.user.click(screen.getByLabelText('Pets'));

    await form.user.click(form.submit());

    expect(await screen.findByText(/please agree to receive emails/i)).toBeInTheDocument();
    expect(form.consent()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(DEMO_PANEL)).toBeNull();
  });

  it('shows the demo panel, with a way onward, after a valid submission', async () => {
    const form = setup();
    await form.user.type(form.email(), 'sam@example.com');
    await form.user.click(screen.getByLabelText('Food & drink'));
    await form.user.click(screen.getByLabelText('Weekly round-up'));
    await form.user.click(form.consent());

    await form.user.click(form.submit());

    expect(await screen.findByText(DEMO_PANEL)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse freebies' })).toHaveAttribute(
      'href',
      '/freebies'
    );
    expect(screen.queryByRole('button', { name: /send me free alerts/i })).toBeNull();
  });

  it('restores the form with the typed email after "Change my answers"', async () => {
    const form = setup();
    await form.user.type(form.email(), 'sam@example.com');
    await form.user.click(screen.getByLabelText('Beauty & skincare'));
    await form.user.click(form.consent());
    await form.user.click(form.submit());
    await screen.findByText(DEMO_PANEL);

    await form.user.click(screen.getByRole('button', { name: 'Change my answers' }));

    expect(form.email()).toHaveValue('sam@example.com');
    expect(form.email()).toBeEnabled();
    expect(screen.getByLabelText('Beauty & skincare')).toBeChecked();
    expect(form.submit()).toBeInTheDocument();
    expect(screen.queryByText(DEMO_PANEL)).toBeNull();
  });

  it('defaults to daily highlights and prefills a provided email', () => {
    render(<AlertsForm categories={CATEGORIES} defaultEmail="pre@example.com" />);

    expect(screen.getByLabelText('Daily highlights')).toBeChecked();
    expect(screen.getByLabelText('Weekly round-up')).not.toBeChecked();
    expect(screen.getByLabelText(/email address/i)).toHaveValue('pre@example.com');
  });
});
