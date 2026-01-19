import { useState } from "react";
// @ts-ignore - JSX component
import LoginForm from "../components/LoginForm";
// @ts-ignore - JSX component
import RegisterForm from "../components/RegisterForm";
// @ts-ignore - JSX component
import ResetPassword from "../components/ResetPassword";
import bgImage from "../img.jpg";

export default function Login() {
  // mode: 'login' | 'register' | 'reset'
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');

  const onSwitchToRegister = () => {
    console.log('Switching to Register');
    setMode('register');
  };

  const onSwitchToLogin = () => {
    console.log('Switching to Login');
    setMode('login');
  };

  const onSwitchToReset = () => {
    console.log('Switching to Reset Password');
    setMode('reset');
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {mode === 'login' && (
        <LoginForm
          onSwitchToRegister={onSwitchToRegister}
          onSwitchToReset={onSwitchToReset}
        />
      )}

      {mode === 'register' && (
        <RegisterForm onSwitchToLogin={onSwitchToLogin} />
      )}

      {mode === 'reset' && (
        <ResetPassword onClose={onSwitchToLogin} />
      )}
    </div>
  );
}