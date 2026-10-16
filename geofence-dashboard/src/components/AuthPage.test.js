import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthPage from './AuthPage';

describe('AuthPage Component - Minimal Singla Sign In', () => {
  const mockOnLogin = jest.fn();
  const mockOnBackToLanding = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders minimal Sign In portal with clean hierarchy and Back button', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    // Check heading
    const heading = screen.getByRole('heading', { name: /sign in/i });
    expect(heading).toBeInTheDocument();

    // Check Back to Home button
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();

    // Check subtle disclosure for manual entry
    expect(screen.getByRole('button', { name: /or enter credentials manually/i })).toBeInTheDocument();
  });

  test('renders ONLY Bhavishya Singla login and does not show other personas', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    // Bhavishya Singla is present
    expect(screen.getByText(/bhavishya singla/i)).toBeInTheDocument();
    expect(screen.getByText(/singla_be23@thapar.edu/i)).toBeInTheDocument();

    // Other personas are NOT present
    expect(screen.queryByText(/dr\. rajesh sharma/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/priya singla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ananya verma/i)).not.toBeInTheDocument();
  });

  test('1-click Singla action immediately logs in as Bhavishya Singla', async () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    const singlaBtn = screen.getByRole('button', { name: /sign in as bhavishya singla/i });
    fireEvent.click(singlaBtn);

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

  test('calls onBackToLanding when Back to Home is clicked', () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    const backBtn = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(backBtn);

    expect(mockOnBackToLanding).toHaveBeenCalledTimes(1);
  });

  test('expands manual credentials form and submits successfully', async () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    // Initially inputs are hidden
    expect(screen.queryByLabelText(/login id \/ institutional email/i)).not.toBeInTheDocument();

    // Click toggle to reveal
    const toggleBtn = screen.getByRole('button', { name: /or enter credentials manually/i });
    fireEvent.click(toggleBtn);

    // Inputs now visible
    expect(screen.getByLabelText(/login id \/ institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session password/i)).toBeInTheDocument();

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledTimes(1);
      expect(mockOnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'singla_be23@thapar.edu',
        })
      );
    });
  });

  test('shows error when invalid manual credentials submitted', async () => {
    render(<AuthPage onLogin={mockOnLogin} onBackToLanding={mockOnBackToLanding} />);

    // Reveal form
    fireEvent.click(screen.getByRole('button', { name: /or enter credentials manually/i }));

    const emailInput = screen.getByLabelText(/login id \/ institutional email/i);
    const passwordInput = screen.getByLabelText(/session password/i);

    fireEvent.change(emailInput, { target: { value: 'unknown@user.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(mockOnLogin).not.toHaveBeenCalled();
    });
  });
});
