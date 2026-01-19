import React, { useState } from 'react';
import { auth } from '../config/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import '../styles/RegisterForm.css';

const RegisterForm = ({ onSwitchToLogin }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setMessage('Please fill in all fields');
      setMessageType('error');
      return;
    }

    if (firstName.length < 2) {
      setMessage('First name must be at least 2 characters');
      setMessageType('error');
      return;
    }

    if (lastName.length < 2) {
      setMessage('Last name must be at least 2 characters');
      setMessageType('error');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      setMessageType('error');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fullName = `${firstName} ${lastName}`;
      await updateProfile(userCredential.user, { displayName: fullName });

      setMessage(`Account created successfully! Welcome, ${fullName}!`);
      setMessageType('success');

      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    } catch (error) {
      setMessageType('error');
      switch (error.code) {
        case 'auth/email-already-in-use':
          setMessage('Email is already registered');
          break;
        case 'auth/invalid-email':
          setMessage('Invalid email address');
          break;
        case 'auth/weak-password':
          setMessage('Password is too weak');
          break;
        default:
          setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginClick = (e) => {
    e.preventDefault();
    if (typeof onSwitchToLogin === 'function') onSwitchToLogin();
  };

  return (
    <form className="main register-form" onSubmit={handleRegister}>
      <div className="appname">
        <i className="bx bx-shield"></i>
        <h1>SafeRoute</h1>
      </div>

      <h2 className="form-title">Create Account</h2>

      <div className="inputbox">
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-user"></i>
      </div>

      <div className="inputbox">
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-user"></i>
      </div>

      <div className="inputbox">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-envelope"></i>
      </div>

      <div className="inputbox">
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-lock"></i>
      </div>

      <div className="inputbox">
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
        />
        <i className="bx bx-lock"></i>
      </div>

      <button type="submit" className="LogIn" disabled={loading}>
        {loading ? 'Creating Account...' : 'Register'}
      </button>

      <div className="login-link">
        <p>Already have an account? <a href="#login" onClick={handleLoginClick}>Log In</a></p>
      </div>

      {message && (
        <div id="message" className={`message ${messageType}`}>
          {message}
        </div>
      )}
    </form>
  );
};

export default RegisterForm;
