export default function Landing({
  organizerName = '',
  onCreateCourse,
  onJoinCourse,
  onOpenOrganizer,
  onSignOut,
}) {
  return (
    <section className="team-panel-wrap">
      <div className="team-panel-card landing-card">
        <div>
          <p className="team-panel-eyebrow">Pub Golf</p>
          <h1 className="landing-title">Start a round</h1>
          <p className="team-panel-subtitle">
            Organizers create a course. Players join with the game code, team code, and their name.
          </p>
        </div>

        <div className="landing-actions">
          <button type="button" className="choice-button" onClick={onCreateCourse}>
            <span className="choice-title">Create a Course</span>
            <span className="choice-copy">For organizers setting up a new event.</span>
          </button>
          <button type="button" className="choice-button" onClick={onJoinCourse}>
            <span className="choice-title">Join a Course</span>
            <span className="choice-copy">For players joining a team that already exists.</span>
          </button>
        </div>

        {organizerName ? (
          <div className="landing-account">
            <p className="team-panel-muted">Signed in as {organizerName}</p>
            <div className="team-panel-actions">
              <button type="button" className="secondary-button" onClick={onOpenOrganizer}>
                Your courses
              </button>
              <button type="button" className="secondary-button" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
