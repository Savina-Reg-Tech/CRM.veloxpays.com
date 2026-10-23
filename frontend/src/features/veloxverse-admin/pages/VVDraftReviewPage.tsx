// One customer email draft: /dashboard/veloxverse/pickdrop/emails/drafts/:id
import { useParams } from 'react-router-dom'
import DraftReview from '../components/pickdrop-emails/DraftReview'

export default function VVDraftReviewPage() {
  const { id = '' } = useParams<{ id: string }>()
  // Keyed so moving to the next draft starts from a clean screen.
  return <DraftReview key={id} id={id} />
}
