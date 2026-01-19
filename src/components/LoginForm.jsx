import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider , githubProvider} from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider 
} from 'firebase/auth';
import '../styles/LoginForm.css';


const LoginForm = ({onSwitchToRegister,onSwitchToReset}) => {
  const navigate = useNavigate();
 useEffect(() => {console.log('LoginFormprops:', {
      onSwitchToRegister: typeof onSwitchToRegister,
      onSwitchToReset: typeof onSwitchToReset,
    });
  }, [onSwitchToRegister, onSwitchToReset]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Handle Email/Password Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setMessage('Please enter both email and password');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setMessage(`Welcome, ${userCredential.user.email}!`);
      setMessageType('success');
      
      // Reset form
      setEmail('');
      setPassword('');
      
      // Redirect immediately to main page
      console.log('User logged in:', userCredential.user);
      navigate('/', { replace: true });
    } catch (error) {
      setMessageType('error');
      
      switch (error.code) {
        case 'auth/invalid-email':
          setMessage('Invalid email address');
          break;
        case 'auth/user-disabled':
          setMessage('User account is disabled');
          break;
        case 'auth/user-not-found':
          setMessage('User account not found.  Please register first');
          break;
        case 'auth/wrong-password': 
          setMessage('Invalid password');
          break;
        default:
          setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };
    const handleRegisterClick = (e) => {
    e.preventDefault();
    console.log('LoginForm: Register link clicked. calling prop...');
    if (typeof onSwitchToRegister === 'function') {
      onSwitchToRegister();
    } else {
      console.warn('LoginForm: onSwitchToRegister prop not provided to LoginForm');
    }
  };
   const handleForgotClick = (e) => {
    e.preventDefault();
    if (typeof onSwitchToReset === 'function') onSwitchToReset();
    else console.warn('LoginForm: onSwitchToReset not provided');
  };
  const handleGitHubSignIn = async () => {
    setLoading(true);
    setMessage(''); 
    try {
      const result = await signInWithPopup(auth, githubProvider);
      setMessage(`Welcome, ${result.user.displayName || result.user.email}!`);
      setMessageType('success');
      console.log('User logged in with GitHub:', result.user);
      navigate('/', { replace: true });
    } catch (error) {
      setMessageType('error');
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          setMessage('Sign-in popup was closed');
          break;
        case 'auth/popup-blocked':
          setMessage('Sign-in popup was blocked by browser');
          break;
        case 'auth/operation-not-allowed':
          setMessage('Google sign-in is not enabled');
          break;
        default: 
          setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      setMessage(`Welcome, ${result.user.displayName}!`);
      setMessageType('success');
      
      // Redirect immediately to main page
      console.log('User logged in with Google:', result.user);
      navigate('/', { replace: true });
    } catch (error) {
      setMessageType('error');
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          setMessage('Sign-in popup was closed');
          break;
        case 'auth/popup-blocked':
          setMessage('Sign-in popup was blocked by browser');
          break;
        case 'auth/operation-not-allowed':
          setMessage('Google sign-in is not enabled');
          break;
        default: 
          setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="main" onSubmit={handleEmailLogin}>
      <div className="appname">
        <i className='bx bx-shield'></i>
        <h1>SafeRoute</h1>
      </div>

      <div className="inputbox">
        <input 
          type="email" 
          id="email" 
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <i className='bx bx-user'></i>
      </div>

      <div className="inputbox">
        <input 
          type="password" 
          id="password" 
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <i className='bx bx-lock'></i>
      </div>

      <div className="remember-forgot">
        <label>
          <input type="checkbox" disabled={loading} /> Remember Me
        </label>
        <a href="#forgot" onClick={handleForgotClick}>Forgot Password?</a>
      </div>

      <button 
        type="submit" 
        className="LogIn" 
        id="loginForm"
        disabled={loading}
      >
        {loading ? 'Logging In...' : 'Log In'}
      </button>

      <div className="register-link">
        <p>Don't have an account? <a href="#register"
          onClick={handleRegisterClick}
          >Register</a></p>
      </div>

      <div className="or">
        <p>OR</p>
      </div>

      <div className="Google">
        <button 
          type="button"
          className="LogIn" 
          id="googleSignIn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? 'Signing In.. .' : 'Sign In with Google'}
        </button>
        <div className="googlelogo">
          <img src="https://static.dezeen.com/uploads/2025/05/sq-google-g-logo-update_dezeen_2364_col_0.jpg" alt="Google" />
        </div>
      </div>

      <div className="GitHub">
        <button 
          type="button" 
          className="LogIn"
          id="githubSignIn"
          onClick={handleGitHubSignIn}
          disabled={loading}
        >
          {loading ? 'Signing In.. .' : 'Sign In with GitHub'}
        </button>
        <div className="githublogo">
          <img src="https://images.icon-icons.com/3685/PNG/512/github_logo_icon_229278.png" alt="GitHub" />
        </div>
      </div>

      {message && (
        <div id="message" className={`message ${messageType}`}>
          {message}
        </div>
      )}
      <div className="imp">
      <p>Only one Email account can be used for Sign In or Log In with only one service</p>
      </div>
    </form>
  );
};

export default LoginForm;