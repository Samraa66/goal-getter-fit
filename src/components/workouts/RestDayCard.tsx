import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Leaf, 
  Brain, 
  Plus, 
  Check, 
  Timer, 
  Activity,
  ChevronDown,
  ChevronUp,
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  HeartPulse
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RestDayActivity {
  id: string;
  sport: string;
  duration: number;
  intensity: "low" | "moderate";
  loggedAt: Date;
}

interface RestDayCardProps {
  onActivityLogged?: (activity: Omit<RestDayActivity, "id" | "loggedAt">) => void;
}

const QUICK_ACTIVITIES = [
  { icon: Footprints, label: "Walking", value: "walking" },
  { icon: Bike, label: "Cycling", value: "cycling" },
  { icon: Waves, label: "Swimming", value: "swimming" },
  { icon: Activity, label: "Football", value: "football" },
  { icon: HeartPulse, label: "Yoga", value: "yoga" },
];

const STRETCHING_SUGGESTIONS = [
  { name: "Full Body Stretch", duration: "10 min", focus: "All major muscle groups" },
  { name: "Hip Openers", duration: "8 min", focus: "Hips & lower back" },
  { name: "Upper Body Release", duration: "7 min", focus: "Shoulders, neck & chest" },
  { name: "Foam Rolling", duration: "12 min", focus: "Deep tissue recovery" },
];

const MEDITATION_OPTIONS = [
  { name: "Guided Breathing", duration: "5 min", type: "guided" },
  { name: "Body Scan", duration: "10 min", type: "guided" },
  { name: "Unguided Silence", duration: "Custom", type: "unguided" },
];

export function RestDayCard({ onActivityLogged }: RestDayCardProps) {
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [selectedSport, setSelectedSport] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<"low" | "moderate">("low");
  const [loggedActivities, setLoggedActivities] = useState<RestDayActivity[]>([]);
  const [expandedSection, setExpandedSection] = useState<"activity" | "stretch" | "meditation" | null>("activity");
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const handleLogActivity = () => {
    const sport = selectedSport === "other" ? customSport : selectedSport;
    if (!sport || !duration) return;

    const activity: RestDayActivity = {
      id: crypto.randomUUID(),
      sport,
      duration: parseInt(duration),
      intensity,
      loggedAt: new Date(),
    };

    setLoggedActivities(prev => [...prev, activity]);
    onActivityLogged?.({ sport, duration: parseInt(duration), intensity });

    // Reset form
    setSelectedSport("");
    setCustomSport("");
    setDuration("");
    setIntensity("low");
    setShowActivityForm(false);
  };

  const toggleComplete = (itemId: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSection = (section: "activity" | "stretch" | "meditation") => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Rest Day Header */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Leaf className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Rest & Recovery Day</h3>
              <p className="text-sm text-muted-foreground">Stay engaged with light activities</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logged Activities */}
      {loggedActivities.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-primary mb-2">Today's Activities</p>
            <div className="space-y-2">
              {loggedActivities.map(activity => (
                <div key={activity.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="capitalize text-foreground">{activity.sport}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {activity.duration} min • {activity.intensity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Light Activity Section */}
      <Card className="border-border">
        <CardContent className="p-0">
          <button
            onClick={() => toggleSection("activity")}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-foreground">Log Light Activity</span>
            </div>
            {expandedSection === "activity" ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {expandedSection === "activity" && (
            <div className="px-4 pb-4 space-y-3">
              {!showActivityForm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => setShowActivityForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Activity
                </Button>
              ) : (
                <div className="space-y-3 p-3 rounded-lg bg-secondary/50">
                  {/* Quick Select */}
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIVITIES.map(({ icon: Icon, label, value }) => (
                      <button
                        key={value}
                        onClick={() => setSelectedSport(value)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors",
                          selectedSport === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground hover:bg-secondary/80"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedSport("other")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs transition-colors",
                        selectedSport === "other"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                    >
                      Other...
                    </button>
                  </div>

                  {/* Custom Sport Input */}
                  {selectedSport === "other" && (
                    <Input
                      placeholder="Enter activity name"
                      value={customSport}
                      onChange={(e) => setCustomSport(e.target.value)}
                      className="h-9 text-sm"
                    />
                  )}

                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Duration (min)"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                  </div>

                  {/* Intensity */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIntensity("low")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                        intensity === "low"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      Low Intensity
                    </button>
                    <button
                      onClick={() => setIntensity("moderate")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                        intensity === "moderate"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      Moderate
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowActivityForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleLogActivity}
                      disabled={!selectedSport || (selectedSport === "other" && !customSport) || !duration}
                      className="flex-1"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Log
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stretching Section */}
      <Card className="border-border">
        <CardContent className="p-0">
          <button
            onClick={() => toggleSection("stretch")}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <Dumbbell className="h-5 w-5 text-purple-400" />
              <span className="font-medium text-foreground">Stretching</span>
            </div>
            {expandedSection === "stretch" ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {expandedSection === "stretch" && (
            <div className="px-4 pb-4 space-y-2">
              {STRETCHING_SUGGESTIONS.map((stretch, i) => (
                <button
                  key={i}
                  onClick={() => toggleComplete(`stretch-${i}`)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                    completedItems.has(`stretch-${i}`)
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      completedItems.has(`stretch-${i}`)
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}>
                      {completedItems.has(`stretch-${i}`) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-sm font-medium",
                        completedItems.has(`stretch-${i}`) ? "text-primary" : "text-foreground"
                      )}>
                        {stretch.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{stretch.focus}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{stretch.duration}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meditation Section */}
      <Card className="border-border">
        <CardContent className="p-0">
          <button
            onClick={() => toggleSection("meditation")}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-indigo-400" />
              <span className="font-medium text-foreground">Meditation</span>
            </div>
            {expandedSection === "meditation" ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {expandedSection === "meditation" && (
            <div className="px-4 pb-4 space-y-2">
              {MEDITATION_OPTIONS.map((meditation, i) => (
                <button
                  key={i}
                  onClick={() => toggleComplete(`meditation-${i}`)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                    completedItems.has(`meditation-${i}`)
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      completedItems.has(`meditation-${i}`)
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}>
                      {completedItems.has(`meditation-${i}`) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-sm font-medium",
                        completedItems.has(`meditation-${i}`) ? "text-primary" : "text-foreground"
                      )}>
                        {meditation.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{meditation.type}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{meditation.duration}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
