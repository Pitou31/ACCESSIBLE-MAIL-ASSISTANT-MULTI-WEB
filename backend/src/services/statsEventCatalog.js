const STATS_EVENT_TYPES = Object.freeze([
  "session_started",
  "session_ended",
  "workflow_started",
  "workflow_ended",
  "mail_opened",
  "mail_loaded",
  "mail_classified",
  "mail_prioritized",
  "draft_generation_started",
  "draft_generation_succeeded",
  "draft_generation_failed",
  "reply_generation_started",
  "reply_generation_succeeded",
  "reply_generation_failed",
  "summary_started",
  "summary_succeeded",
  "summary_failed",
  "rephrase_started",
  "rephrase_succeeded",
  "rephrase_failed",
  "translation_started",
  "translation_succeeded",
  "translation_failed",
  "audio_read_started",
  "audio_read_paused",
  "audio_read_resumed",
  "audio_read_stopped",
  "audio_input_started",
  "audio_input_paused",
  "audio_input_resumed",
  "audio_input_stopped",
  "attachment_added",
  "attachment_removed",
  "attachment_text_extracted",
  "attachment_text_extraction_failed",
  "draft_edited",
  "draft_validated",
  "draft_rejected",
  "reply_sent",
  "reply_cancelled",
  "model_changed",
  "language_changed",
  "stats_viewed",
  "rules_viewed",
  "rules_created",
  "rules_updated",
  "rules_deleted",
  "model_evaluation_started",
  "model_evaluation_completed"
])

const STATS_EVENT_TYPE_SET = new Set(STATS_EVENT_TYPES)

function isKnownStatsEventType(eventType = "") {
  return STATS_EVENT_TYPE_SET.has(String(eventType || "").trim())
}

module.exports = {
  STATS_EVENT_TYPES,
  isKnownStatsEventType
}
