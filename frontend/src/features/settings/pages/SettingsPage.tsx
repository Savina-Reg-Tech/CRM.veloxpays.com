import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage workspace-level settings and preferences.
        </p>
      </div>

      <Card>
        <CardHeader
          title="General Settings"
          description="Core system preferences are being prepared."
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            This module is available as a stable route and ready for upcoming
            configuration features.
          </p>
          <Badge variant="info">Coming soon</Badge>
        </div>
      </Card>
    </div>
  )
}
