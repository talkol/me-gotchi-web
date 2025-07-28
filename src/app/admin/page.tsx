"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { ref, listAll, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, storage, app } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, Trash2, Plus, LogOut, User as UserIcon, RefreshCw } from "lucide-react";
import Image from "next/image";

// Client-side only rendering
export const ssr = false;

interface InviteCodeData {
  code: string;
  firstName?: string;
  completed: boolean;
  unused: boolean;
  characterUrl?: string;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeData[]>([]);
  const [loadingInviteCodes, setLoadingInviteCodes] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Check authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load invite codes when authenticated
  useEffect(() => {
    if (user) {
      loadInviteCodes();
    }
  }, [user]);

  const loadInviteCodes = async () => {
    setLoadingInviteCodes(true);
    try {
      const storageRef = ref(storage);
      const result = await listAll(storageRef);
      
      const codesData: InviteCodeData[] = [];
      
      for (const folder of result.prefixes) {
        const code = folder.name;
        
        try {
          // Try to get preferences.json
          const preferencesRef = ref(storage, `${code}/preferences.json`);
          const preferencesUrl = await getDownloadURL(preferencesRef);
          const response = await fetch(preferencesUrl);
          const preferences = await response.json();
          
          // Try to get character.png
          let characterUrl: string | undefined;
          try {
            const characterRef = ref(storage, `${code}/character.png`);
            characterUrl = await getDownloadURL(characterRef);
          } catch {
            // Character image doesn't exist
          }
          
          // Check if the invite code is unused by looking for firstName
          const hasFirstName = preferences.firstName && preferences.firstName.trim() !== '';
          const isUnused = !hasFirstName;
          
          codesData.push({
            code,
            firstName: preferences.firstName,
            completed: preferences.environments && 
                      preferences.environments[0]?.explanation?.trim() && 
                      preferences.environments[1]?.explanation?.trim() && 
                      preferences.environments[2]?.explanation?.trim() && 
                      preferences.environments[3]?.explanation?.trim(),
            unused: isUnused,
            characterUrl
          });
        } catch (error) {
          // Folder exists but no preferences.json, consider it incomplete
          codesData.push({
            code,
            completed: false,
            unused: true, // No preferences.json means it's unused
            characterUrl: undefined
          });
        }
      }
      
      setInviteCodes(codesData);
    } catch (error) {
      console.error("Error loading invite codes:", error);
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive"
      });
    } finally {
      setLoadingInviteCodes(false);
    }
  };

  const generateRandomInviteCode = () => {
    const generateCode = () => {
      const part1 = Math.floor(1000 + Math.random() * 9000);
      const part2 = Math.floor(1000 + Math.random() * 9000);
      const part3 = Math.floor(1000 + Math.random() * 9000);
      return `${part1}-${part2}-${part3}`;
    };
    
    let code = generateCode();
    // Ensure uniqueness (simple check against existing codes)
    while (inviteCodes.some(ic => ic.code === code)) {
      code = generateCode();
    }
    
    setNewInviteCode(code);
  };

  const generateInviteCode = async () => {
    if (!newInviteCode) return;
    
    setIsGenerating(true);
    try {
      // Call the Firebase Function to create the invite code with public access
      const functionsInstance = getFunctions(app, 'us-central1');
      const generateInviteCodeFunction = httpsCallable(functionsInstance, 'generateInviteCode');
      
      const result = await generateInviteCodeFunction({ inviteCode: newInviteCode });
      const data = result.data as { success: boolean; message: string; publicUrl: string };
      
      if (data.success) {
        toast({
          title: "Success",
          description: data.message,
        });
        
        setNewInviteCode("");
        loadInviteCodes(); // Refresh the list
      } else {
        throw new Error(data.message || "Failed to create invite code");
      }
    } catch (error: any) {
      console.error("Error creating invite code:", error);
      const errorMessage = error.message || "Failed to create invite code";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteInviteCode = async (code: string) => {
    setIsDeleting(code);
    try {
      // List all files in the folder and delete them
      const folderRef = ref(storage, code);
      const result = await listAll(folderRef);
      
      // Delete all files in the folder
      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      
      toast({
        title: "Success",
        description: `Invite code ${code} deleted successfully`,
      });
      
      loadInviteCodes(); // Refresh the list
    } catch (error) {
      console.error("Error deleting invite code:", error);
      toast({
        title: "Error",
        description: "Failed to delete invite code",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const regenerateInviteCode = async (oldCode: string) => {
    setIsRegenerating(oldCode);
    try {
      // Generate new code
      const generateCode = () => {
        const part1 = Math.floor(1000 + Math.random() * 9000);
        const part2 = Math.floor(1000 + Math.random() * 9000);
        const part3 = Math.floor(1000 + Math.random() * 9000);
        return `${part1}-${part2}-${part3}`;
      };
      
      let newCode = generateCode();
      // Ensure uniqueness against existing codes
      while (inviteCodes.some(ic => ic.code === newCode)) {
        newCode = generateCode();
      }

      // List all files in the old folder
      const oldFolderRef = ref(storage, oldCode);
      const result = await listAll(oldFolderRef);
      
      // Copy all files to new folder
      const copyPromises = result.items.map(async (item) => {
        const oldPath = item.fullPath;
        const newPath = oldPath.replace(oldCode, newCode);
        
        // If this is preferences.json, handle it specially
        if (oldPath.endsWith('preferences.json')) {
          const downloadURL = await getDownloadURL(item);
          const response = await fetch(downloadURL);
          const text = await response.text();
          const preferences = JSON.parse(text);
          preferences.inviteCode = newCode; // Update the invite code
          
          // Upload the updated preferences.json
          const newRef = ref(storage, newPath);
          const updatedBlob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
          await uploadBytes(newRef, updatedBlob);
        } else {
          // For other files, download and upload as-is
          const downloadURL = await getDownloadURL(item);
          const response = await fetch(downloadURL);
          const blob = await response.blob();
          
          // Upload to new location
          const newRef = ref(storage, newPath);
          await uploadBytes(newRef, blob);
        }
      });
      
      await Promise.all(copyPromises);
      
      // Delete old folder
      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      
      toast({
        title: "Success",
        description: `Invite code ${oldCode} regenerated to ${newCode}`,
      });
      
      loadInviteCodes(); // Refresh the list
    } catch (error) {
      console.error("Error regenerating invite code:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate invite code",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(null);
    }
  };

  const viewInviteCode = (code: string) => {
    router.push(`/invite/onboarding/?code=${encodeURIComponent(code)}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return <GoogleLoginForm />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage invite codes and user data</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserIcon className="w-4 h-4" />
              {user.email}
            </div>
            <Button variant="outline" onClick={handleSignOut} className="w-full md:w-auto">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Create New Invite Code */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Invite Code
            </CardTitle>
            <CardDescription>
              Generate a new invitation code in the format XXXX-XXXX-XXXX
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Click Generate to create a new code"
                value={newInviteCode}
                onChange={(e) => setNewInviteCode(e.target.value)}
                className="flex-1"
              />
              <Button onClick={generateRandomInviteCode} variant="outline">
                Generate
              </Button>
              <Button 
                onClick={generateInviteCode} 
                disabled={!newInviteCode || isGenerating}
              >
                {isGenerating ? "Creating..." : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invite Codes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Invite Codes</CardTitle>
            <CardDescription>
              {inviteCodes.length} invite code{inviteCodes.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInviteCodes ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                Loading invite codes...
              </div>
            ) : inviteCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invite codes found
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Character</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes.map((inviteCode) => (
                        <TableRow key={inviteCode.code}>
                          <TableCell className="font-mono">{inviteCode.code}</TableCell>
                          <TableCell>
                            {inviteCode.characterUrl ? (
                              <Image
                                src={inviteCode.characterUrl}
                                alt="Character"
                                width={40}
                                height={40}
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">none</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {inviteCode.firstName || (
                              <span className="text-muted-foreground">Not started</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              inviteCode.unused ? "outline" : 
                              inviteCode.completed ? "default" : "secondary"
                            }>
                              {inviteCode.unused ? "Unused" : 
                               inviteCode.completed ? "Completed" : "In Progress"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => viewInviteCode(inviteCode.code)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => regenerateInviteCode(inviteCode.code)}
                                disabled={isRegenerating === inviteCode.code}
                              >
                                <RefreshCw className={`w-4 h-4 mr-1 ${isRegenerating === inviteCode.code ? 'animate-spin' : ''}`} />
                                {isRegenerating === inviteCode.code ? "Regenerating..." : "Regenerate Code"}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={isDeleting === inviteCode.code}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    {isDeleting === inviteCode.code ? "Deleting..." : "Delete"}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Invite Code</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete invite code "{inviteCode.code}"? 
                                      This will permanently remove all associated data and cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteInviteCode(inviteCode.code)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {inviteCodes.map((inviteCode) => (
                    <div key={inviteCode.code} className="border rounded-lg p-4 space-y-3">
                      {/* Row 1: Code and Status */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-muted-foreground">Code</div>
                          <div className="font-mono text-base">{inviteCode.code}</div>
                        </div>
                        <Badge variant={
                          inviteCode.unused ? "outline" : 
                          inviteCode.completed ? "default" : "secondary"
                        }>
                          {inviteCode.unused ? "Unused" : 
                           inviteCode.completed ? "Completed" : "In Progress"}
                        </Badge>
                      </div>

                                             {/* Row 2: Character and First Name */}
                       <div className="flex items-center justify-between">
                         <div className="flex-1">
                           <div className="text-sm font-medium text-muted-foreground mb-1">Character</div>
                           {inviteCode.characterUrl ? (
                             <Image
                               src={inviteCode.characterUrl}
                               alt="Character"
                               width={40}
                               height={40}
                               className="rounded-full object-cover"
                             />
                           ) : (
                             <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                               <span className="text-xs text-muted-foreground">none</span>
                             </div>
                           )}
                         </div>
                         <div className="flex-1 text-right">
                           <div className="text-sm font-medium text-muted-foreground">First Name</div>
                           <div className="text-base">
                             {inviteCode.firstName || (
                               <span className="text-muted-foreground">Not started</span>
                             )}
                           </div>
                         </div>
                       </div>

                      {/* Row 3: Actions */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Actions</div>
                                                 <div className="flex flex-wrap gap-2">
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => viewInviteCode(inviteCode.code)}
                             className="flex-1 min-w-0"
                           >
                             View
                           </Button>
                           <Button
                             size="sm"
                             variant="secondary"
                             onClick={() => regenerateInviteCode(inviteCode.code)}
                             disabled={isRegenerating === inviteCode.code}
                             className="flex-1 min-w-0"
                           >
                             {isRegenerating === inviteCode.code ? "Regenerating..." : "Regenerate"}
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button
                                 size="sm"
                                 variant="destructive"
                                 disabled={isDeleting === inviteCode.code}
                                 className="flex-1 min-w-0"
                               >
                                 {isDeleting === inviteCode.code ? "Deleting..." : "Delete"}
                               </Button>
                             </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Invite Code</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete invite code "{inviteCode.code}"? 
                                  This will permanently remove all associated data and cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteInviteCode(inviteCode.code)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Google Login Form Component
function GoogleLoginForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>
            Sign in with Google to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGoogleLogin} 
            className="w-full" 
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                Signing in...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </div>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 