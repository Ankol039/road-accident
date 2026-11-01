/**
 * Categories and settings. Replaces admin-settings.php +
 * js-release-20261020b/pages/admin-settings.js.
 *
 * Three panels, the way the PHP screen had them:
 *   * the accident categories, with how many reports use each one
 *   * the system settings, including the duplicate rule and the officer
 *     arrival check the report detail screen reads
 *   * the emergency contacts the mobile app shows on its home screen
 *
 * A category is never deleted, because reports already use it; it is hidden
 * from the report form instead.
 */
import { useEffect, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { useActor } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import {
  listAccidentTypes,
  accidentTypeUsage,
  saveAccidentType,
  toggleAccidentType,
  getSystemSettings,
  saveSystemSettings,
  DEFAULT_SETTINGS,
  listEmergencyContacts,
  saveEmergencyContact,
  deleteEmergencyContact,
} from '../services/settings.service.js'
import Modal from '../components/Modal.jsx'
import { errorMessage, ValidationError } from '../lib/errors.js'

const EMPTY_TYPE = { id: '', name: '', description: '' }
const EMPTY_CONTACT = { id: '', name: '', phone: '', category: '', sort_order: 0, is_active: true }

/** The categories the legacy datalist offered for a contact. */
const CONTACT_CATEGORIES = ['Emergency', 'Police', 'Rescue', 'Medical', 'Fire']

export default function Settings() {
  const actor = useActor()
  const toast = useToast()

  /* ---------- accident categories ---------- */
  const { data: types, loading: typesLoading, reload: reloadTypes } = useAsync(
    () => listAccidentTypes(),
    [],
    [],
  )
  const { data: usage, reload: reloadUsage } = useAsync(() => accidentTypeUsage(), [], {})
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE)
  const [typeErrors, setTypeErrors] = useState({})
  const [typeBusy, setTypeBusy] = useState(false)

  /* ---------- system settings ---------- */
  const { data: settings, loading: settingsLoading, reload: reloadSettings } = useAsync(
    () => getSystemSettings(),
    [],
    DEFAULT_SETTINGS,
  )
  const [settingsForm, setSettingsForm] = useState(null)
  const [settingsErrors, setSettingsErrors] = useState({})
  const [settingsBusy, setSettingsBusy] = useState(false)

  // The form is filled once the settings have arrived. Waiting for the load
  // to finish matters: until then the data is still the defaults, and those
  // would overwrite what is stored.
  useEffect(() => {
    if (!settingsLoading && settings) setSettingsForm({ ...settings })
  }, [settingsLoading, settings])

  /* ---------- emergency contacts ---------- */
  const { data: contacts, loading: contactsLoading, reload: reloadContacts } = useAsync(
    () => listEmergencyContacts(),
    [],
    [],
  )
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT)
  const [contactErrors, setContactErrors] = useState({})
  const [contactBusy, setContactBusy] = useState(false)
  const [removing, setRemoving] = useState(null)

  /* ---------- categories ---------- */
  const editType = (type) => {
    setTypeForm({ id: type.id, name: type.name || '', description: type.description || '' })
    setTypeErrors({})
  }

  const resetTypeForm = () => {
    setTypeForm(EMPTY_TYPE)
    setTypeErrors({})
  }

  const submitType = async (event) => {
    event.preventDefault()
    setTypeErrors({})
    setTypeBusy(true)
    try {
      await saveAccidentType(typeForm.id || null, typeForm, actor)
      toast.success(typeForm.id ? 'Category saved' : 'Category added')
      resetTypeForm()
      reloadTypes()
      reloadUsage()
    } catch (err) {
      if (err instanceof ValidationError) setTypeErrors(err.errors)
      else toast.failure(errorMessage(err))
    } finally {
      setTypeBusy(false)
    }
  }

  const flipType = async (type) => {
    try {
      await toggleAccidentType(type.id, type.active === false, actor)
      toast.success(type.active === false ? `${type.name} is shown again` : `${type.name} is hidden from the report form`)
      reloadTypes()
    } catch (err) {
      toast.failure(errorMessage(err))
    }
  }

  /* ---------- system settings ---------- */
  const submitSettings = async (event) => {
    event.preventDefault()
    setSettingsErrors({})
    setSettingsBusy(true)
    try {
      const { changed } = await saveSystemSettings(settingsForm, actor)
      toast.success(Object.keys(changed).length ? 'Settings saved' : 'Nothing changed')
      reloadSettings()
    } catch (err) {
      if (err instanceof ValidationError) setSettingsErrors(err.errors)
      else toast.failure(errorMessage(err))
    } finally {
      setSettingsBusy(false)
    }
  }

  /* ---------- emergency contacts ---------- */
  const editContact = (contact) => {
    setContactForm({
      id: contact.id,
      name: contact.name || '',
      phone: contact.phone || '',
      category: contact.category || '',
      sort_order: contact.sort_order ?? 0,
      is_active: contact.is_active !== false,
    })
    setContactErrors({})
  }

  const resetContactForm = () => {
    setContactForm(EMPTY_CONTACT)
    setContactErrors({})
  }

  const submitContact = async (event) => {
    event.preventDefault()
    setContactErrors({})
    setContactBusy(true)
    try {
      await saveEmergencyContact(contactForm.id || null, contactForm, actor)
      toast.success(contactForm.id ? 'Contact saved' : 'Contact added')
      resetContactForm()
      reloadContacts()
    } catch (err) {
      if (err instanceof ValidationError) setContactErrors(err.errors)
      else toast.failure(errorMessage(err))
    } finally {
      setContactBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    try {
      await deleteEmergencyContact(removing.id, actor)
      toast.success('Contact removed')
      reloadContacts()
    } catch (err) {
      toast.failure(errorMessage(err))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      <h1 className="h3 mb-3">Categories and settings</h1>

      <div className="row g-4">
        <div className="col-xl-7">
          <section className="panel">
            <h2 className="h5">Accident categories</h2>
            <p className="small text-secondary">
              Categories that reports already use cannot be deleted. Hide them instead: they
              disappear from the report form but old reports keep them.
            </p>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-end">Reports</th>
                    <th>Form</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {typesLoading && (
                    <tr>
                      <td colSpan={4} className="text-secondary">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!typesLoading && types.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-secondary">
                        No categories yet.
                      </td>
                    </tr>
                  )}
                  {types.map((t) => (
                    <tr key={t.id} className={t.active === false ? 'text-secondary' : ''}>
                      <td>
                        <strong>{t.name}</strong>
                        {t.description ? (
                          <span className="small text-secondary d-block">{t.description}</span>
                        ) : null}
                      </td>
                      <td className="text-end">{usage?.[t.id] ?? 0}</td>
                      <td>{t.active === false ? 'Hidden' : 'Shown on the form'}</td>
                      <td className="text-end text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editType(t)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => flipType(t)}
                        >
                          {t.active === false ? 'Show' : 'Hide'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form className="row g-2 align-items-end" onSubmit={submitType} noValidate>
              <div className="col-sm-4">
                <label className="form-label small mb-1" htmlFor="t-name">
                  Name
                </label>
                <input
                  id="t-name"
                  name="name"
                  className={`form-control${typeErrors.name ? ' is-invalid' : ''}`}
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                />
                {typeErrors.name ? (
                  <div className="invalid-feedback d-block">{typeErrors.name}</div>
                ) : null}
              </div>
              <div className="col-sm-5">
                <label className="form-label small mb-1" htmlFor="t-desc">
                  Description
                </label>
                <input
                  id="t-desc"
                  name="description"
                  className="form-control"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="col-sm-3 d-flex gap-1">
                <button className="btn btn-guide flex-grow-1" type="submit" disabled={typeBusy}>
                  {typeBusy ? 'Saving…' : typeForm.id ? 'Save category' : 'Add category'}
                </button>
                {typeForm.id ? (
                  <button
                    type="button"
                    className="btn btn-link px-1"
                    onClick={resetTypeForm}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>

        <div className="col-xl-5">
          <form className="panel" onSubmit={submitSettings} noValidate>
            <h2 className="h5">System settings</h2>

            <div className="mb-3">
              <label className="form-label" htmlFor="s-name">
                System name
              </label>
              <input
                id="s-name"
                name="system_name"
                className={`form-control${settingsErrors.system_name ? ' is-invalid' : ''}`}
                value={settingsForm?.system_name ?? ''}
                onChange={(e) => setSettingsForm((f) => ({ ...f, system_name: e.target.value }))}
                disabled={settingsLoading}
              />
              {settingsErrors.system_name ? (
                <div className="invalid-feedback d-block">{settingsErrors.system_name}</div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="s-photos">
                Photos allowed per report (all sections)
              </label>
              <input
                id="s-photos"
                name="max_photos_per_report"
                type="number"
                min="3"
                max="15"
                className={`form-control${settingsErrors.max_photos_per_report ? ' is-invalid' : ''}`}
                value={settingsForm?.max_photos_per_report ?? ''}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, max_photos_per_report: e.target.value }))
                }
                disabled={settingsLoading}
              />
              {settingsErrors.max_photos_per_report ? (
                <div className="invalid-feedback d-block">
                  {settingsErrors.max_photos_per_report}
                </div>
              ) : null}
              <div className="form-text">
                Sections: scene, plate number, damage (required), people affected, other. Up to 3 per
                section.
              </div>
            </div>

            <fieldset>
              <legend className="form-label fs-6 mb-1">Duplicate rule (FR-08)</legend>
              <p className="small text-secondary mb-2">
                Nearby reports with the same accident type and close incident times are flagged as
                possible duplicates. An admin reviews and confirms them; they are not automatically
                closed.
              </p>
              <div className="mb-3">
                <label className="form-label" htmlFor="s-window">
                  Incident time window (minutes)
                </label>
                <input
                  id="s-window"
                  name="duplicate_window_minutes"
                  type="number"
                  min="1"
                  max="1440"
                  className={`form-control${settingsErrors.duplicate_window_minutes ? ' is-invalid' : ''}`}
                  value={settingsForm?.duplicate_window_minutes ?? ''}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, duplicate_window_minutes: e.target.value }))
                  }
                  disabled={settingsLoading}
                />
                {settingsErrors.duplicate_window_minutes ? (
                  <div className="invalid-feedback d-block">
                    {settingsErrors.duplicate_window_minutes}
                  </div>
                ) : null}
              </div>
              <div className="mb-3">
                <label className="form-label small mb-1" htmlFor="s-radius">
                  Duplicate radius (meters)
                </label>
                <input
                  id="s-radius"
                  name="duplicate_radius_m"
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  className={`form-control${settingsErrors.duplicate_radius_m ? ' is-invalid' : ''}`}
                  value={settingsForm?.duplicate_radius_m ?? ''}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, duplicate_radius_m: e.target.value }))
                  }
                  disabled={settingsLoading}
                />
                {settingsErrors.duplicate_radius_m ? (
                  <div className="invalid-feedback d-block">{settingsErrors.duplicate_radius_m}</div>
                ) : null}
                <div className="form-text">
                  Phone GPS is often 5 to 20 m off, so some real duplicates may be farther apart. You
                  can still flag those by hand.
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="form-label fs-6 mb-1">Officer arrival check</legend>
              <p className="small text-secondary mb-2">
                When the officer taps &quot;I&apos;ve arrived&quot;, the locations match if he is this
                close to the reporter&apos;s pin. GPS supports the review. If the pins differ or
                accuracy is uncertain, record supporting evidence to approve or ask for another
                arrival.
              </p>
              <div className="mb-3">
                <label className="form-label small mb-1" htmlFor="s-match">
                  Match distance (meters)
                </label>
                <input
                  id="s-match"
                  name="arrival_match_radius_m"
                  type="number"
                  min="5"
                  max="500"
                  step="1"
                  className={`form-control${settingsErrors.arrival_match_radius_m ? ' is-invalid' : ''}`}
                  value={settingsForm?.arrival_match_radius_m ?? ''}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, arrival_match_radius_m: e.target.value }))
                  }
                  disabled={settingsLoading}
                />
                {settingsErrors.arrival_match_radius_m ? (
                  <div className="invalid-feedback d-block">
                    {settingsErrors.arrival_match_radius_m}
                  </div>
                ) : null}
              </div>
            </fieldset>

            <button className="btn btn-guide" type="submit" disabled={settingsBusy || settingsLoading}>
              {settingsBusy ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        </div>

        <div className="col-12">
          <section className="panel">
            <h2 className="h5">Emergency contacts</h2>
            <p className="small text-secondary">
              Shown on the home screen of the mobile app. Add your local MDRRMO, PNP station and
              hospitals.
            </p>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Shown</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {contactsLoading && (
                    <tr>
                      <td colSpan={5} className="text-secondary">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!contactsLoading && contacts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-secondary">
                        No contacts yet.
                      </td>
                    </tr>
                  )}
                  {contacts.map((c) => (
                    <tr key={c.id} className={c.is_active === false ? 'text-secondary' : ''}>
                      <td>{c.sort_order}</td>
                      <td>
                        <strong>{c.name}</strong>
                        {c.category ? (
                          <span className="small text-secondary d-block">{c.category}</span>
                        ) : null}
                      </td>
                      <td>{c.phone}</td>
                      <td>{c.is_active === false ? 'Hidden' : 'Shown'}</td>
                      <td className="text-end text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editContact(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setRemoving(c)}
                          aria-label={`Remove ${c.name}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form className="row g-2 align-items-end" onSubmit={submitContact} noValidate>
              <div className="col-md-3">
                <label className="form-label small mb-1" htmlFor="c-name">
                  Name
                </label>
                <input
                  id="c-name"
                  name="name"
                  className={`form-control${contactErrors.name ? ' is-invalid' : ''}`}
                  value={contactForm.name}
                  onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                />
                {contactErrors.name ? (
                  <div className="invalid-feedback d-block">{contactErrors.name}</div>
                ) : null}
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1" htmlFor="c-phone">
                  Phone
                </label>
                <input
                  id="c-phone"
                  name="phone"
                  className={`form-control${contactErrors.phone ? ' is-invalid' : ''}`}
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                />
                {contactErrors.phone ? (
                  <div className="invalid-feedback d-block">{contactErrors.phone}</div>
                ) : null}
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1" htmlFor="c-cat">
                  Category
                </label>
                <input
                  id="c-cat"
                  name="category"
                  className="form-control"
                  list="c-cats"
                  value={contactForm.category}
                  onChange={(e) => setContactForm((f) => ({ ...f, category: e.target.value }))}
                />
                <datalist id="c-cats">
                  {CONTACT_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-1" htmlFor="c-order">
                  Order
                </label>
                <input
                  id="c-order"
                  name="sort_order"
                  type="number"
                  className="form-control"
                  value={contactForm.sort_order}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                />
              </div>
              <div className="col-md-1">
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="c-active"
                    name="is_active"
                    checked={contactForm.is_active}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  <label className="form-check-label small" htmlFor="c-active">
                    Shown
                  </label>
                </div>
              </div>
              <div className="col-md-3 d-flex gap-1">
                <button className="btn btn-guide flex-grow-1" type="submit" disabled={contactBusy}>
                  {contactBusy ? 'Saving…' : contactForm.id ? 'Save contact' : 'Add contact'}
                </button>
                {contactForm.id ? (
                  <button
                    type="button"
                    className="btn btn-link px-1"
                    onClick={resetContactForm}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      </div>

      <Modal
        open={Boolean(removing)}
        title="Remove this contact?"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-outline-danger" onClick={confirmRemove}>
              Remove
            </button>
          </>
        }
      >
        <p className="mb-0">
          <strong>{removing?.name}</strong> will no longer be shown on the home screen of the
          mobile app.
        </p>
      </Modal>
    </>
  )
}
