import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import '../styles/ResetPassword.css';

const ResetPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage('Please enter your email address.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('If an account with that email exists, a reset link has been sent.');
      setMessageType('success');
    } catch (error) {
      setMessageType('error');
      switch (error.code) {
        case 'auth/invalid-email':
          setMessage('Invalid email address.');
          break;
        case 'auth/user-not-found':
          setMessage('No account found with this email.');
          break;
        case 'auth/too-many-requests':
          setMessage('Too many requests. Please try again later.');
          break;
        default:
          setMessage(error.message || 'Failed to send reset email.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="main reset-password-form" onSubmit={handleSubmit}>
      <div className="appname">
        <i className="bx bx-shield"></i>
        <h1>SafeRoute</h1>
      </div>

      <h2 className="form-title">Reset Password</h2>

      <div className="inputbox">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-envelope"></i>
      </div>

      <button className="LogIn" type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </button>

      <div className="login-link">
        <p><a href="#login" onClick={(e) => { e.preventDefault(); if (typeof onClose === 'function') onClose(); }}>Back to Login</a></p>
      </div>

      {message && (
        <div id="message" className={`message ${messageType}`}>
          {message}
        </div>
      )}
    </form>
  );
};

export default ResetPassword;
