import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthPage from './AuthPage';
import auth from '../auth';

describe('AuthPage Component', () => {
  const mockOnLogin = jest.fn();
  const mockOnBackToLanding = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders Caregiver Access Portal heading and elements with clear hierarchy', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    // Check heading
    const heading = screen.getByRole('heading', { name: /caregiver access portal/i });
    expect(heading).toBeInTheDocument();

    // Check inputs
    expect(screen.getByLabelText(/login id \/ institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session password/i)).toBeInTheDocument();

    // Check submit button
    expect(screen.getByRole('button', { name: /sign in to dashboard/i })).toBeInTheDocument();

    // Check Back to Home button
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
  });

  test('renders dedicated test persona chips and handles selection', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    expect(screen.getByText(/bhavishya singla/i)).toBeInTheDocument();
    expect(screen.getByText(/dr\. rajesh sharma/i)).toBeInTheDocument();

    // Click Dr. Rajesh Sharma chip
    const sharmaBtn = screen.getByRole('button', { name: /dr\. rajesh sharma/i });
    fireEvent.click(sharmaBtn);

    const emailInput = screen.getByLabelText(/login id \/ institutional email/i);
    expect(emailInput.value).toBe('dr.sharma@thapar.edu');
  });

  test('calls onBackToLanding when Back to Home is clicked', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    const backBtn = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(backBtn);

    expect(mockOnBackToLanding).toHaveBeenCalledTimes(1);
  });

  test('submits valid institutional credentials and calls onLogin', async () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledTimes(1);
      expect(mockOnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'singla_be23@thapar.edu',
          role: 'admin',
        })
      );
    });
  });

  test('instant demo sign in logs in immediately', async () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    const instantBtn = screen.getByRole('button', { name: /instant demo sign in/i });
    fireEvent.click(instantBtn);

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledTimes(1);
    });
  });
});
