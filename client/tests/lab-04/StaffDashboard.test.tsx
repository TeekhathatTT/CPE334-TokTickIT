import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffDashboardPage from '../../src/pages/staff/StaffDashboardPage';
import * as api from '../../src/api';

vi.mock('../../src/api');

describe('StaffDashboardPage (lab-04) - IT_STAFF behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all 6 cards with labels for IT_STAFF', async () => {
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 2, assignedToMe: 3, waitingForRequester: 1, pendingFollowUp: 1, pendingFollowUpTicketIds: [11], resolvedPendingClose: 1, newToday: 1, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole='IT_STAFF' />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Unassigned active')).toBeInTheDocument();
    expect(screen.getByText('Assigned to me')).toBeInTheDocument();
    expect(screen.getByText('Waiting for requester')).toBeInTheDocument();
    expect(screen.getByText('Pending follow-up')).toBeInTheDocument();
    expect(screen.getByText('Resolved pending close')).toBeInTheDocument();
    expect(screen.getByText('New today')).toBeInTheDocument();
  });

  it('drill-down filters for each card match spec', async () => {
    const onNavigateQueue = vi.fn();
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 2, assignedToMe: 3, waitingForRequester: 1, pendingFollowUp: 4, pendingFollowUpTicketIds: [1,2,3,4], resolvedPendingClose: 1, newToday: 5, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    const user = userEvent.setup();
    render(<StaffDashboardPage onNavigateQueue={onNavigateQueue} userRole='IT_STAFF' />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    const links = screen.getAllByRole('button', { name: /view queue/i });
    expect(links.length).toBe(6);
    await user.click(links[0]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ ownerId: 'unassigned', status: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] });
    await user.click(links[1]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ ownerId: 'me', status: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'REOPENED'] });
    await user.click(links[2]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ status: 'WAITING_FOR_REQUESTER' });
    await user.click(links[3]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ hasPendingFollowUp: 'true' });
    await user.click(links[4]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ status: 'RESOLVED' });
    await user.click(links[5]);
    expect(onNavigateQueue).toHaveBeenCalledWith({ status: 'NEW', createdSince: '2026-10-09T00:00:00.000Z' });
  });

  it('shows empty state helpers when counts are zero', async () => {
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 0, assignedToMe: 0, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole='IT_STAFF' />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Queue is fully assigned.')).toBeInTheDocument();
    expect(screen.getByText('Nothing is assigned to you.')).toBeInTheDocument();
    expect(screen.getByText('No tickets are waiting on requesters.')).toBeInTheDocument();
    expect(screen.getByText('No pending follow-ups.')).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting to be closed.')).toBeInTheDocument();
    expect(screen.getByText('No new tickets today.')).toBeInTheDocument();
  });
});

describe('StaffDashboardPage (lab-04) - ADMINISTRATOR behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ADMINISTRATOR sees values but no View queue buttons and reason text', async () => {
    const onNavigateQueue = vi.fn();
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 4, assignedToMe: 0, waitingForRequester: 2, pendingFollowUp: 1, pendingFollowUpTicketIds: [5], resolvedPendingClose: 3, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={onNavigateQueue} userRole='ADMINISTRATOR' />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /view queue/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/administrators have no queue access/i).length).toBeGreaterThan(0);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('ADMINISTRATOR empty states show reason instead of links', async () => {
    (api.getStaffDashboard as any).mockResolvedValue({
      unassignedActive: 0, assignedToMe: 0, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    });
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole='ADMINISTRATOR' />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /view queue/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/administrators have no queue access/i).length).toBeGreaterThan(0);
  });
});

describe('StaffDashboardPage (lab-04) - Loading/Error/Retry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading then data', async () => {
    (api.getStaffDashboard as any).mockImplementation(() => new Promise(r => setTimeout(() => r({
      unassignedActive: 1, assignedToMe: 1, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z',
    }), 50)));
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole='IT_STAFF' />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('error with retry reloads data', async () => {
    (api.getStaffDashboard as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ unassignedActive: 3, assignedToMe: 0, waitingForRequester: 0, pendingFollowUp: 0, pendingFollowUpTicketIds: [], resolvedPendingClose: 0, newToday: 0, newTodaySince: '2026-10-09T00:00:00.000Z' });
    const user = userEvent.setup();
    render(<StaffDashboardPage onNavigateQueue={vi.fn()} userRole='IT_STAFF' />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
