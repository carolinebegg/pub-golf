import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CourseRoster from './CourseRoster'

const COURSE_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'roster', label: 'Teams & Players' },
]

export default function OrganizerHome({
  firstName = '',
  courses = [],
  openCourse = null,
  loading = false,
  notice = '',
  membership = null,
  onCreate,
  onOpen,
  onCloseCourse,
  onBackToTeam,
  onSignOut,
}) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [copiedCourseId, setCopiedCourseId] = useState(null)
  const copied = copiedCourseId === openCourse?.id
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await onCreate?.(title)
      if (result?.message) setError(result.message)
      else setTitle('')
    } catch (createError) {
      setError(createError?.message || 'The course could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyCode() {
    if (!openCourse?.join_code) return
    try {
      await navigator.clipboard.writeText(openCourse.join_code)
      setCopiedCourseId(openCourse.id)
    } catch {
      setCopiedCourseId(null)
      setError('Select the game code and copy it manually.')
    }
  }

  if (openCourse) {
    return (
      <OrganizerCourse
        key={openCourse.id}
        course={openCourse}
        firstName={firstName}
        copied={copied}
        error={error}
        membership={membership}
        onCopy={copyCode}
        onCloseCourse={onCloseCourse}
        onBackToTeam={onBackToTeam}
      />
    )
  }

  return (
    <section className="organizer-layout">
      <form onSubmit={handleCreate} className="team-panel-card">
        <div className="organizer-heading">
          <div>
            <p className="team-panel-eyebrow">Organizer mode</p>
            <h2 className="team-panel-title">Your courses</h2>
            <p className="team-panel-subtitle">
              {firstName ? `Signed in as ${firstName}` : 'Signed in'}
            </p>
          </div>
          <span className="status-pill">Organizer</span>
        </div>

        <label className="team-field">
          <span className="team-field-label">Course name</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Friday Crawl"
            className="team-input"
          />
        </label>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create course'}
        </button>
        {notice ? <p className="team-success">{notice}</p> : null}
        {error ? <p className="team-error">{error}</p> : null}
      </form>

      <div className="team-panel-card">
        {loading ? <p className="team-panel-muted">Loading courses...</p> : null}
        {!loading && courses.length === 0 ? (
          <p className="team-panel-muted">No courses yet. Create one to get a game code.</p>
        ) : null}
        <div className="course-list">
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              className="course-list-button"
              onClick={() => onOpen?.(course.id)}
            >
              <span className="course-list-title">{course.title}</span>
              <span className="course-list-code">{course.join_code}</span>
            </button>
          ))}
        </div>
        <div className="team-panel-actions">
          {membership ? (
            <button type="button" className="secondary-button" onClick={onBackToTeam}>
              Back to your team
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </section>
  )
}

function OrganizerCourse({
  course,
  firstName,
  copied,
  error,
  membership,
  onCopy,
  onCloseCourse,
  onBackToTeam,
}) {
  const [section, setSection] = useState('overview')
  const [rosterVisited, setRosterVisited] = useState(false)

  function openSection(next) {
    if (next === 'roster') setRosterVisited(true)
    setSection(next)
  }

  return (
    <section className="team-panel-wrap">
      <div className="team-panel-card organizer-course">
        <div className="organizer-heading">
          <p className="team-panel-eyebrow">Organizer mode</p>
          <span className="status-pill">Organizer</span>
        </div>
        <h2 className="team-panel-title">{course.title}</h2>
        <p className="team-panel-subtitle">
          {firstName ? `Organizer: ${firstName}` : 'Organizer account'}
        </p>

        <label className="team-field">
          <span className="team-field-label">Game code</span>
          <input
            type="text"
            readOnly
            value={course.join_code || ''}
            className="team-input game-code-input"
            onFocus={(event) => event.target.select()}
          />
        </label>

        <div className="team-panel-actions">
          <button type="button" className="primary-button" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy game code'}
          </button>
          <button type="button" className="secondary-button" onClick={onCloseCourse}>
            All courses
          </button>
        </div>

        <nav className="view-switch section-switch" aria-label="Course sections">
          {COURSE_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`view-switch-button${section === item.id ? ' is-active' : ''}`}
              aria-pressed={section === item.id}
              onClick={() => openSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {section === 'overview' ? (
          <p className="team-panel-muted">
            Share the game code with players. Teams and players can be added at any time. Holes come later.
          </p>
        ) : null}

        {rosterVisited ? (
          <div hidden={section !== 'roster'}>
            <CourseRoster courseId={course.id} client={supabase} />
          </div>
        ) : null}

        {membership ? (
          <button type="button" className="text-button" onClick={onBackToTeam}>
            Back to your team
          </button>
        ) : null}
        {error ? <p className="team-error">{error}</p> : null}
      </div>
    </section>
  )
}
