/**
 * The audit log filter form and pager: a plain GET form (every filter in the URL), labelled controls, 44px
 * targets, a Reset link, and a pager that keeps the filters.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditLogsFilters } from '@/app/(admin)/admin/audit-logs/audit-logs-filters';
import { AuditLogsPagination } from '@/app/(admin)/admin/audit-logs/audit-logs-pagination';
import {
  parseAuditLogsQuery,
  type AuditLogsQuery,
} from '@/app/(admin)/admin/audit-logs/audit-logs-query';

const queryOf = (raw: Record<string, string> = {}): AuditLogsQuery =>
  parseAuditLogsQuery(raw).query;

describe('AuditLogsFilters', () => {
  it('is a GET search form to the audit log path, so filters live in the URL', () => {
    render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    const form = screen.getByRole('search', { name: 'Filter audit log entries' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/admin/audit-logs');
  });

  it('labels every control and names the parameter each one submits', () => {
    render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    expect(screen.getByLabelText('Action')).toHaveAttribute('name', 'action');
    expect(screen.getByLabelText('User ID')).toHaveAttribute('name', 'user');
    expect(screen.getByLabelText('Organisation ID')).toHaveAttribute('name', 'org');
    expect(screen.getByLabelText('From date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('From date')).toHaveAttribute('name', 'from');
    expect(screen.getByLabelText('To date')).toHaveAttribute('name', 'to');
    expect(screen.getByLabelText('Entries per page')).toHaveAttribute('name', 'size');
  });

  it('never submits a page number, so applying filters starts at page 1', () => {
    const { container } = render(<AuditLogsFilters query={queryOf({ page: '4' })} notices={[]} />);

    expect(container.querySelector('[name="page"]')).toBeNull();
  });

  it('describes the action format and the UTC dates for assistive technology', () => {
    render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    expect(screen.getByLabelText('Action')).toHaveAccessibleDescription(
      'Exact action, for example admin.offers.update'
    );
    expect(screen.getByLabelText('From date')).toHaveAccessibleDescription(
      'Dates are in UTC and include the whole day.'
    );
  });

  it('offers the allow-listed page sizes and selects the current one', () => {
    render(<AuditLogsFilters query={queryOf({ size: '25' })} notices={[]} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['25', '50', '100']);
    expect(screen.getByLabelText('Entries per page')).toHaveValue('25');
  });

  it('shows the current filters in the controls', () => {
    render(
      <AuditLogsFilters
        query={queryOf({
          action: 'admin.users.ban',
          user: 'u1',
          org: 'o1',
          from: '2026-01-01',
          to: '2026-01-31',
        })}
        notices={[]}
      />
    );

    expect(screen.getByLabelText('Action')).toHaveValue('admin.users.ban');
    expect(screen.getByLabelText('User ID')).toHaveValue('u1');
    expect(screen.getByLabelText('Organisation ID')).toHaveValue('o1');
    expect(screen.getByLabelText('From date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('To date')).toHaveValue('2026-01-31');
  });

  it('bounds the text inputs like the API does', () => {
    render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    expect(screen.getByLabelText('Action')).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('User ID')).toHaveAttribute('maxlength', '128');
    expect(screen.getByLabelText('Organisation ID')).toHaveAttribute('maxlength', '128');
  });

  it('has an Apply button and a Reset link back to the bare path', () => {
    render(<AuditLogsFilters query={queryOf({ action: 'admin.users.ban' })} notices={[]} />);

    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'Reset filters' })).toHaveAttribute(
      'href',
      '/admin/audit-logs'
    );
  });

  it('keeps every control at least 44px tall', () => {
    render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    for (const control of [
      screen.getByLabelText('Action'),
      screen.getByLabelText('From date'),
      screen.getByLabelText('Entries per page'),
      screen.getByRole('button', { name: 'Apply filters' }),
      screen.getByRole('link', { name: 'Reset filters' }),
    ]) {
      expect(control.className).toMatch(/\bh-11\b|\bmin-h-11\b/);
    }
  });

  it('wraps the fields into a responsive grid and the buttons into a wrapping row', () => {
    const { container } = render(<AuditLogsFilters query={queryOf()} notices={[]} />);

    expect(container.querySelector('.grid')?.className).toContain('sm:grid-cols-2');
    expect(
      screen.getByRole('button', { name: 'Apply filters' }).parentElement?.className
    ).toContain('flex-wrap');
  });

  it('lists ignored-filter notices in a polite status region, and none when there are none', () => {
    const { rerender } = render(<AuditLogsFilters query={queryOf()} notices={[]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<AuditLogsFilters query={queryOf()} notices={['The action filter was ignored.']} />);

    expect(screen.getByRole('status')).toHaveTextContent('The action filter was ignored.');
  });
});

describe('AuditLogsPagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<AuditLogsPagination query={queryOf()} total={50} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('links Next with the filters kept', () => {
    render(
      <AuditLogsPagination query={queryOf({ action: 'admin.users.ban', size: '25' })} total={80} />
    );

    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/admin/audit-logs?action=admin.users.ban&size=25&page=2'
    );
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
  });

  it('links Previous back to page 1 without a page parameter', () => {
    render(<AuditLogsPagination query={queryOf({ page: '2', user: 'u1' })} total={120} />);

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/admin/audit-logs?user=u1'
    );
  });

  it('marks the links as previous and next for the browser', () => {
    render(<AuditLogsPagination query={queryOf({ page: '2' })} total={200} />);

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('rel', 'prev');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
  });

  it('keeps a page indicator for a page past the data', () => {
    render(<AuditLogsPagination query={queryOf({ page: '3' })} total={10} />);

    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
  });
});
