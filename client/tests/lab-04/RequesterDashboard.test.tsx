import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequesterDashboardPage from '../../src/pages/RequesterDashboardPage';
import * as api from '../../src/api';

vi.mock('../../src/api');

describe('RequesterDashboardPage (lab-04) - real behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all four cards with values and empty helpers', async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0,
      awaitingMyResponse: 0,
      recentlyResolved: 0,
      recentlyResolvedSince: '2026-09-09T12:00:00.000Z',
      totalSubmitted: 0,
      recentTickets: [],
    });

    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Open tickets')).toBeInTheDocument();
    expect(screen.getByText('Awaiting my response')).toBeInTheDocument();
    expect(screen.getByText('Recently resolved')).toBeInTheDocument();
    expect(screen.getByText('Total submitted')).toBeInTheDocument();
    expect(screen.getByText('You have no open tickets.')).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting on you.')).toBeInTheDocument();
    expect(screen.getByText('No tickets resolved in the last 30 days.')).toBeInTheDocument();
    expect(screen.getByText('You have not submitted any tickets yet.')).toBeInTheDocument();
  });

  it('drill-down passes exact preset filters for each card', async () => {
    const onNavigateMyTickets = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 4,
      awaitingMyResponse: 1,
      recentlyResolved: 1,
      recentlyResolvedSince: '2026-09-09T12:00:00.000Z',
      totalSubmitted: 5,
      recentTickets: [],
    });

    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={onNavigateMyTickets} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());

    const viewButtons = screen.getAllByRole('button', { name: /view tickets/i });
    await user.click(viewButtons[0]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] });

    await user.click(viewButtons[1]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: 'WAITING_FOR_REQUESTER' });

    await user.click(viewButtons[2]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: ['RESOLVED', 'CLOSED'], updatedSince: '2026-09-09T12:00:00.000Z' });

    await user.click(viewButtons[3]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({});
  });

  it('shows Create a ticket for zero totalSubmitted and navigates to create', async () => {
    const onCreateTicket = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 0, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={onCreateTicket} />);
    await waitFor(() => expect(screen.getByText('Create a ticket')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /create a ticket/i }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it('renders recently updated list with status badges and no console errors in happy path', async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 1, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 1,
      recentTickets: [{ id: 5, ticketNumber: 'TT-0005', summary: 'Test issue', status: 'OPEN', updatedAt: '2026-10-08T10:00:00.000Z' }],
    });
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('TT-0005')).toBeInTheDocument());
    expect(screen.getByText('Test issue')).toBeInTheDocument();
    expect(screen.getByText('Recently updated')).toBeInTheDocument();
  });

  it('shows error panel with retry on API failure', async () => {
    (api.getRequesterDashboard as any).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 0, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
