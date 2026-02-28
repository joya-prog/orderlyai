import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, Phone, Globe, CheckCircle2, Clock, Mail } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { formatDistanceToNow, format } from "date-fns";

interface SignupUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  authProvider: string | null;
  restaurantName: string | null;
  restaurantType: string | null;
  restaurantPhone: string | null;
  restaurantWebsite: string | null;
  onboardingCompleted: boolean | null;
  createdAt: string | null;
}

const restaurantTypeLabels: Record<string, string> = {
  fine_dining: "Fine Dining",
  casual_dining: "Casual Dining",
  fast_casual: "Fast Casual",
  cafe: "Cafe / Coffee",
  bar: "Bar / Pub",
  catering: "Catering",
  hotel: "Hotel / Resort",
  other: "Other",
};

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

function SignupCard({ user }: { user: SignupUser }) {
  const signedUpAt = user.createdAt ? new Date(user.createdAt) : null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  const typeLabel = user.restaurantType ? restaurantTypeLabels[user.restaurantType] || user.restaurantType : null;

  return (
    <Card data-testid={`card-signup-${user.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-11 w-11 ring-2 ring-border/40 flex-shrink-0">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
              {getInitials(user.firstName, user.lastName, user.email)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                {fullName && (
                  <p className="font-semibold text-sm truncate" data-testid={`text-name-${user.id}`}>
                    {fullName}
                  </p>
                )}
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-email-${user.id}`}>
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <Badge variant="outline" className="gap-1 text-xs">
                  {user.authProvider === "google" ? (
                    <>
                      <SiGoogle className="h-3 w-3" />
                      Google
                    </>
                  ) : (
                    <>
                      <Mail className="h-3 w-3" />
                      Email
                    </>
                  )}
                </Badge>
                <Badge
                  variant={user.onboardingCompleted ? "secondary" : "outline"}
                  className="gap-1 text-xs"
                  data-testid={`status-onboarding-${user.id}`}
                >
                  {user.onboardingCompleted ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Setup complete
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 text-amber-500" />
                      Pending setup
                    </>
                  )}
                </Badge>
              </div>
            </div>

            {user.onboardingCompleted && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {user.restaurantName && (
                  <span className="flex items-center gap-1" data-testid={`text-restaurant-${user.id}`}>
                    <Building2 className="h-3 w-3 flex-shrink-0" />
                    {user.restaurantName}
                    {typeLabel && (
                      <Badge variant="outline" className="text-xs ml-1 px-1.5 py-0">
                        {typeLabel}
                      </Badge>
                    )}
                  </span>
                )}
                {user.restaurantPhone && (
                  <span className="flex items-center gap-1" data-testid={`text-phone-${user.id}`}>
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {user.restaurantPhone}
                  </span>
                )}
                {user.restaurantWebsite && (
                  <span className="flex items-center gap-1" data-testid={`text-website-${user.id}`}>
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    <a
                      href={user.restaurantWebsite.startsWith("http") ? user.restaurantWebsite : `https://${user.restaurantWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary truncate max-w-[180px]"
                    >
                      {user.restaurantWebsite}
                    </a>
                  </span>
                )}
              </div>
            )}

            {signedUpAt && (
              <p className="text-xs text-muted-foreground" data-testid={`text-date-${user.id}`}>
                Signed up {formatDistanceToNow(signedUpAt, { addSuffix: true })}
                <span className="mx-1">·</span>
                {format(signedUpAt, "MMM d, yyyy h:mm a")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSignups() {
  const { data: signups = [], isLoading } = useQuery<SignupUser[]>({
    queryKey: ["/api/admin/signups"],
    refetchInterval: 30000,
  });

  const completedCount = signups.filter((u) => u.onboardingCompleted).length;
  const pendingCount = signups.filter((u) => !u.onboardingCompleted).length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Signups</h1>
        <p className="text-sm text-muted-foreground">All users who have created an account</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : signups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No signups yet</h3>
            <p className="text-sm text-muted-foreground">Users who sign up will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-lg">{signups.length}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium">{completedCount}</span>
              <span className="text-muted-foreground">set up</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{pendingCount}</span>
              <span className="text-muted-foreground">pending</span>
            </div>
          </div>

          <div className="space-y-3">
            {signups.map((user) => (
              <SignupCard key={user.id} user={user} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
