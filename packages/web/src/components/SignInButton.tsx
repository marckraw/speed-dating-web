"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "./ui/button";
import { useAuth } from "@/providers/AuthProvider";

export const SignInButton = () => {
  const { user, loading } = useAuth();

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  if (loading) {
    return <Button disabled>Loading...</Button>;
  }

  if (user) {
    console.log("Firebase User:", user);

    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-right">
          <div>Welcome, {user.displayName}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          <div className="text-xs text-muted-foreground">UID: {user.uid}</div>
        </div>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>
    );
  }

  return <Button onClick={signInWithGoogle}>Sign in with Google</Button>;
};
