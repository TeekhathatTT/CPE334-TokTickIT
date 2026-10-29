import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequesterDashboardPage from '../../src/pages/RequesterDashboardPage';
import * as api from '../../src/api';

vi.mock('../../src/api');

describe('RequesterDashboardPage (lab-04) - Authentication/Display/Drill-down', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders all four cards with correct labels and empty states when zero', async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 0, recentTickets: [],
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

  it('displays actual numeric values from API', async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 7, awaitingMyResponse: 2, recentlyResolved: 4, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 12, recentTickets: [],
    });
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('drill-down open tickets passes correct preset filters', async () => {
    const onNavigateMyTickets = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 4, awaitingMyResponse: 1, recentlyResolved: 1, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 5, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={onNavigateMyTickets} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
    const viewButtons = screen.getAllByRole('button', { name: /view tickets/i });
    await user.click(viewButtons[0]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] });
  });

  it('drill-down awaiting my response passes WAITING_FOR_REQUESTER', async () => {
    const onNavigateMyTickets = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 1, awaitingMyResponse: 3, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 1, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={onNavigateMyTickets} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    const viewButtons = screen.getAllByRole('button', { name: /view tickets/i });
    await user.click(viewButtons[1]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: 'WAITING_FOR_REQUESTER' });
  });

  it('drill-down recently resolved passes RESOLVED|CLOSED with updatedSince', async () => {
    const onNavigateMyTickets = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 2, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 3, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={onNavigateMyTickets} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    const viewButtons = screen.getAllByRole('button', { name: /view tickets/i });
    await user.click(viewButtons[2]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({ status: ['RESOLVED', 'CLOSED'], updatedSince: '2026-09-09T12:00:00.000Z' });
  });

  it('drill-down total submitted passes no filters', async () => {
    const onNavigateMyTickets = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 5, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={onNavigateMyTickets} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    const viewButtons = screen.getAllByRole('button', { name: /view tickets/i });
    await user.click(viewButtons[3]);
    expect(onNavigateMyTickets).toHaveBeenCalledWith({});
  });

  it('Create a ticket CTA shown when totalSubmitted is 0 and navigates to create', async () => {
    const onCreateTicket = vi.fn();
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 0, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 0, recentTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={onCreateTicket} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /create a ticket/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /create a ticket/i }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it('renders recentTickets with ticket number, summary, status badge', async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      openTickets: 1, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 1,
      recentTickets: [{ id: 5, ticketNumber: 'TT-0005', summary: 'Network connectivity issue', status: 'OPEN', updatedAt: '2026-10-08T10:00:00.000Z' }],
    });
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('TT-0005')).toBeInTheDocument());
    expect(screen.getByText('Network connectivity issue')).toBeInTheDocument();
    expect(screen.getByText('Recently updated')).toBeInTheDocument();
  });

  it('shows loading state then content', async () => {
    (api.getRequesterDashboard as any).mockImplementation(() => new Promise(r => setTimeout(() => r({
      openTickets: 1, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 1, recentTickets: [],
    }), 50)));
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'Open tickets' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Total submitted' })).getByText('1')).toBeInTheDocument();
  });

  it('error state with retry reloads data', async () => {
    (api.getRequesterDashboard as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ openTickets: 2, awaitingMyResponse: 0, recentlyResolved: 0, recentlyResolvedSince: '2026-09-09T12:00:00.000Z', totalSubmitted: 2, recentTickets: [] });
    const user = userEvent.setup();
    render(<RequesterDashboardPage onNavigateMyTickets={vi.fn()} onCreateTicket={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'Open tickets' })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Total submitted' })).getByText('2')).toBeInTheDocument();
  });
});
