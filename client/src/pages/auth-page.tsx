import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity } from "lucide-react";

export default function AuthPage() {
  const {
    user,
    loginMutation,
    registerMutation,
    requestPasswordResetMutation,
    resetPasswordMutation,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const isPasswordResetEnabled =
    import.meta.env.VITE_PASSWORD_RESET_ENABLED === "true";

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const loginForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { email: "", password: "" },
  });

  const requestResetSchema = z.object({
    email: z.string().email("Enter a valid email."),
  });

  const resetSchema = z.object({
    email: z.string().email("Enter a valid email."),
    token: z.string().min(1, "Reset token is required."),
    newPassword: z.string().min(6, "Password must be at least 6 characters."),
  });

  const requestResetForm = useForm<z.infer<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "", token: "", newPassword: "" },
  });

  const handleRequestReset = async (data: z.infer<typeof requestResetSchema>) => {
    setTokenCopied(false);
    try {
      const result = await requestPasswordResetMutation.mutateAsync(data);
      if (result?.resetToken) {
        setIssuedToken(result.resetToken);
        resetForm.setValue("email", data.email);
        resetForm.setValue("token", result.resetToken);
      } else {
        setIssuedToken(null);
      }
    } catch {
      setIssuedToken(null);
    }
  };

  const handleCopyToken = async () => {
    if (!issuedToken) return;
    await navigator.clipboard.writeText(issuedToken);
    setTokenCopied(true);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your professional trading journal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className={`grid w-full ${isPasswordResetEnabled ? "grid-cols-3" : "grid-cols-2"} mb-4`}>
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
                {isPasswordResetEnabled && (
                  <TabsTrigger value="reset">Reset</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit((data) =>
                      loginMutation.mutate(data)
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="trader@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      Login
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit((data) =>
                      registerMutation.mutate(data)
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="trader@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      Register Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              {isPasswordResetEnabled && (
                <TabsContent value="reset">
                <div className="space-y-6">
                  <Form {...requestResetForm}>
                    <form
                      onSubmit={requestResetForm.handleSubmit(handleRequestReset)}
                      className="space-y-3"
                    >
                      <FormField
                        control={requestResetForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="trader@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full"
                        disabled={requestPasswordResetMutation.isPending}
                      >
                        Request Reset Token
                      </Button>
                    </form>
                  </Form>

                  {issuedToken && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Reset Token (Dev Only)
                      </div>
                      <div className="flex gap-2">
                        <Input readOnly value={issuedToken} />
                        <Button type="button" variant="secondary" onClick={handleCopyToken}>
                          {tokenCopied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Token expires in 1 hour.
                      </div>
                    </div>
                  )}

                  <Form {...resetForm}>
                    <form
                      onSubmit={resetForm.handleSubmit((data) =>
                        resetPasswordMutation.mutate(data)
                      )}
                      className="space-y-3"
                    >
                      <FormField
                        control={resetForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="trader@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetForm.control}
                        name="token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reset Token</FormLabel>
                            <FormControl>
                              <Input placeholder="Paste token" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={resetPasswordMutation.isPending}
                      >
                        Set New Password
                      </Button>
                    </form>
                  </Form>
                </div>
              </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-col items-center justify-center bg-muted p-8 text-muted-foreground">
        <Activity className="h-24 w-24 mb-4 text-primary animate-pulse" />
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Trading Journal Plus
        </h1>
        <p className="text-xl max-w-md text-center">
          Track your trades, analyze your performance, and master the markets.
        </p>
      </div>
    </div>
  );
}
