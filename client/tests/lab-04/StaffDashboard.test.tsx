import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffDashboardPage from '../../src/pages/staff/StaffDashboardPage';
import * as api from '../../src/api';

vi.mock('../../src/api');

describe('StaffDashboardPage (lab-04) - real behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all six cards for IT_STAFF with links to exact filters', async () => {
    const onNavigateQueue = vi.fn();
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 2,
      assignedToMe: 3,
      waitingForRequester: 1,
      pendingFollowUp: 1,
      pendingFollowUpTicketIds: [11],
      resolvedPendingClose: 1,
      newToday: 1,
      newTodaySince: '2026-10-09T00:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<StaffDashboardPage onNavigateQueue={onNavigateQueue} userRole="IT_STAFF" />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Unassigned active')).toBeInTheDocument();
    expect(screen.getByText('Assigned to me')).toBeInTheDocument();
    expect(screen.getByText('Waiting for requester')).toBeInTheDocument();
    expect(screen.getByText('Pending follow-up')).toBeInTheDocument();
    expect(screen.getByText('Resolved pending close')).toBeInTheDocument();
    expect(screen.getByText('New today')).toBeInTheDocument();

    const links = screen.getAllByRole('button', { name: /view queue/i });
    expect(links.length).toBe(6);
    await user.click(links[0]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ ownerId: 'unassigned', status: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] });
    await user.click(links[3]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ hasPendingFollowUp: 'true' });
    await user.click(links[5]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ status: 'NEW', createdSince: '2026-10-09T00:00:00.000Z' });
  });

  it('shows empty helpers when counts are zero', async () => {
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 0, assignedToMe: 0, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole="IT_STAFF" />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Queue is fully assigned.')).toBeInTheDocument();
    expect(screen.getByText('Nothing is assigned to you.')).toBeInTheDocument();
    expect(screen.getByText('No tickets are waiting on requesters.')).toBeInTheDocument();
    expect(screen.getByText('No pending follow-ups.')).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting to be closed.')).toBeInTheDocument();
    expect(screen.getByText('No new tickets today.')).toBeInTheDocument();
  });

  it('for ADMINISTRATOR shows values without links and reason text (no queue access)', async () => {
    const onNavigateQueue = vi.fn();
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 4, assignedToMe: 0, waitingForRequester: 2, pendingFollowUp: 1, pendingFollowUpTicketIds: [5], resolvedPendingClose: 3, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={onNavigateQueue} userRole="ADMINISTRATOR" />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /view queue/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/administrators have no queue access/i).length).toBeGreaterThan(0);
  });

  it('shows error with retry', async () => {
    (api.getStaffDashboard as any).mockRejectedValueOnce(new Error('err')).mockResolvedValueOnce({
      unassignedActive: 0, assignedToMe: 0, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    const user = userEvent.setup();
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole="IT_STAFF" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
