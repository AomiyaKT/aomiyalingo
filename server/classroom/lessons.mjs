export function createClassroomLessons({ words, course, json }) {
  function roomWords(room) {
    return (room?.vocabulary ? JSON.parse(room.vocabulary) : words).filter(
      (w) => !room?.word_group || room.word_group === 'all' || w.group === room.word_group,
    );
  }
  function roomModes(room) {
    try {
      const modes = course.practiceSettings(room?.modes).modes;
      return Array.isArray(modes) && modes.length ? modes : ['text', 'voice', 'spelling'];
    } catch {
      return ['text', 'voice', 'spelling'];
    }
  }
  function newLesson(mode, room) {
    const allowed = roomModes(room);
    return {
      ...(course.practiceSettings(room.modes).format === 'adaptive-four' && mode !== 'spelling'
        ? course.createStepUp(roomWords(room), room.round_size)
        : course.create(
            roomWords(room),
            mode === 'spelling' && allowed.includes('spelling') ? ['spelling'] : allowed,
            room.round_size,
          )),
      vocabulary: roomWords(room),
      grade: room.grade || 6,
      unit: room.grade === 5 ? '5' : room.unit || '4-5',
    };
  }
  function roomState(room) {
    return {
      active: !!room?.active,
      accepting: !!room?.active && !!room.accepting && !room.ended,
      paused: !!room?.paused,
      ended: !room?.active || !!room?.ended,
      title: room?.title || '',
    };
  }
  const closed = (room) =>
    json(
      {
        error: room?.paused
          ? '先生が練習を一時停止しました。再開までお待ちください。'
          : '授業は終了しました。記録は保存されています。',
        code: room?.paused ? 'CLASS_PAUSED' : 'CLASS_CLOSED',
      },
      423,
    );

  return { roomWords, roomModes, newLesson, roomState, closed };
}
