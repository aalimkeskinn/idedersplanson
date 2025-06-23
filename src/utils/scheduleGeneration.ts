// --- START OF FILE src/utils/scheduleGeneration.ts (SİZİN KODUNUZUN HATASI DÜZELTİLMİŞ HALİ) ---

import { DAYS, PERIODS, Schedule, Teacher, Class, Subject, ScheduleSlot } from '../types';
import { SubjectTeacherMapping, EnhancedGenerationResult } from '../types/wizard';
import { TimeConstraint } from '../types/constraints';

function addFixedPeriodsToGrid(grid: Schedule['schedule'], classLevel: 'Anaokulu' | 'İlkokul' | 'Ortaokul') {
  const fixedSlot: ScheduleSlot = { isFixed: true, classId: 'fixed-period' };
  const lunchPeriod = (classLevel === 'Ortaokul') ? '6' : '5';
  
  const fixedPeriodsMap: { [period: string]: ScheduleSlot } = {
    'prep': { ...fixedSlot, subjectId: 'Hazırlık/Kahvaltı' },
    'afternoon-breakfast': { ...fixedSlot, subjectId: 'İkindi Kahvaltısı' },
    [lunchPeriod]: { ...fixedSlot, subjectId: 'Yemek' },
  };

  if (classLevel === 'Ortaokul') {
    fixedPeriodsMap['breakfast'] = { ...fixedSlot, subjectId: 'Kahvaltı' };
  }
  
  DAYS.forEach(day => {
    if (!grid[day]) grid[day] = {};
    Object.entries(fixedPeriodsMap).forEach(([period, slotData]) => {
      // ÖNEMLİ: Sabit periyotları atarken ızgarayı kontrol etme, doğrudan yaz.
      grid[day][period] = slotData;
    });
  });
}

export function generateSystematicSchedule(
  mappings: SubjectTeacherMapping[],
  allTeachers: Teacher[],
  allClasses: Class[],
  allSubjects: Subject[],
  timeConstraints: TimeConstraint[]
): EnhancedGenerationResult {
  
  const startTime = Date.now();
  console.log('🚀 Program oluşturma başlatıldı (v32 - Sizin Kodunuzun Düzeltilmiş Hali)...');

  const classScheduleGrids: { [classId: string]: Schedule['schedule'] } = {};
  const teacherAvailability: { [teacherId: string]: Set<string> } = {};
  // --- YENİ ve TEK GEREKLİ EKLEME ---
  const classAvailability: { [classId: string]: Set<string> } = {};
  const TOTAL_TARGET_HOURS = 45;

  const selectedClassIds = new Set(mappings.map(m => m.classId));

  allClasses.forEach(c => {
    if (selectedClassIds.has(c.id)) {
      classScheduleGrids[c.id] = {};
      classAvailability[c.id] = new Set<string>(); // Her sınıf için meşguliyet seti başlat
      DAYS.forEach(day => { classScheduleGrids[c.id][day] = {}; });
      addFixedPeriodsToGrid(classScheduleGrids[c.id], c.level);
    }
  });
  allTeachers.forEach(t => { teacherAvailability[t.id] = new Set<string>(); });
  
  const constraintMap = new Map<string, string>();
  timeConstraints.forEach(c => {
    const key = `${c.entityType}-${c.entityId}-${c.day}-${c.period}`;
    constraintMap.set(key, c.constraintType);
  });

  const fixedTasks: { mapping: SubjectTeacherMapping, taskId: string, placed: boolean }[] = [];
  const flexibleTasks: { mapping: SubjectTeacherMapping, taskId: string, placed: boolean }[] = [];

  mappings.forEach(mapping => {
    const hasPreferredSlots = timeConstraints.some(c => c.entityType === 'subject' && c.entityId === mapping.subjectId && c.constraintType === 'preferred');
    for (let i = 0; i < mapping.weeklyHours; i++) {
      const task = { mapping, taskId: `${mapping.id}-${i}`, placed: false };
      if (hasPreferredSlots) fixedTasks.push(task);
      else flexibleTasks.push(task);
    }
  });

  const placeTask = (task: { mapping: SubjectTeacherMapping }, slots: string[]) => {
    const { teacherId, classId, subjectId } = task.mapping;
    for (const slotKey of slots) {
      const [day, period] = slotKey.split('-');
      const isTeacherUnavailable = constraintMap.get(`teacher-${teacherId}-${day}-${period}`) === 'unavailable';
      const isClassUnavailable = constraintMap.get(`class-${classId}-${day}-${period}`) === 'unavailable';

      // --- ANA DEĞİŞİKLİK VE KESİN KONTROL BURADA ---
      // 1. Öğretmen o saatte dolu mu?
      // 2. Sınıf o saatte dolu mu?
      // 3. Izgaranın kendisi dolu mu (sabit periyotlar için)?
      if (!teacherAvailability[teacherId]?.has(slotKey) && !classAvailability[classId]?.has(slotKey) && !classScheduleGrids[classId]?.[day]?.[period] && !isTeacherUnavailable && !isClassUnavailable) {
        classScheduleGrids[classId][day][period] = { subjectId, teacherId, classId, isFixed: false };
        teacherAvailability[teacherId].add(slotKey);
        classAvailability[classId].add(slotKey); // SINIFIN MEŞGULİYETİNİ DE İŞARETLE
        return true; // Yerleştirildi
      }
    }
    return false; // Yerleştirilemedi
  };

  // 1. ADIM: SABİT KURALLI DERSLERİ YERLEŞTİR
  fixedTasks.forEach(task => {
    const preferredSlots = timeConstraints.filter(c => c.entityType === 'subject' && c.entityId === task.mapping.subjectId && c.constraintType === 'preferred').map(c => `${c.day}-${c.period}`);
    preferredSlots.sort(() => Math.random() - 0.5);
    task.placed = placeTask(task, preferredSlots);
  });

  // 2. ADIM: ESNEK DERSLERİ YERLEŞTİR
  flexibleTasks.forEach(task => {
    const allPossibleSlots: string[] = [];
    DAYS.forEach(day => PERIODS.forEach(period => {
        if (constraintMap.get(`subject-${task.mapping.subjectId}-${day}-${period}`) !== 'unavailable') {
            allPossibleSlots.push(`${day}-${period}`);
        }
    }));
    allPossibleSlots.sort(() => Math.random() - 0.5);
    task.placed = placeTask(task, allPossibleSlots);
  });
  
  // 3. ADIM: ETÜT DOLDURMA (GÜVENLİ HALE GETİRİLDİ)
  for (const classId of selectedClassIds) {
    const classItem = allClasses.find(c => c.id === classId);
    if (!classItem) continue;

    const classGrid = classScheduleGrids[classId];
    let currentHours = 0;
    DAYS.forEach(day => PERIODS.forEach(period => { if (classGrid[day]?.[period] && !classGrid[day][period].isFixed) currentHours++; }));
    const hoursToFill = TOTAL_TARGET_HOURS - currentHours;
    if (hoursToFill <= 0) continue;
    
    const classTeacher = allTeachers.find(t => t.id === classItem.classTeacherId);
    const dutyTeacher = classTeacher || allTeachers.find(t => t.branch.toLowerCase().includes('nöbetçi')) || allTeachers[0];

    if (dutyTeacher) {
        let filledCount = 0;
        const allPossibleSlots = [];
        DAYS.forEach(day => PERIODS.forEach(period => allPossibleSlots.push(`${day}-${period}`)));
        allPossibleSlots.sort(() => Math.random() - 0.5);

        for (const slotKey of allPossibleSlots) {
            if (filledCount >= hoursToFill) break;
            if (!teacherAvailability[dutyTeacher.id]?.has(slotKey) && !classAvailability[classId]?.has(slotKey)) {
                const [day, period] = slotKey.split('-');
                if (!classGrid[day]?.[period]) {
                    const etutSubject = allSubjects.find(s => s.name.toLowerCase().includes('etüt')) || { id: 'etut-dersi', name: 'Etüt', branch: 'Etüt' };
                    classGrid[day][period] = { subjectId: etutSubject.id, teacherId: dutyTeacher.id, classId, isFixed: false };
                    teacherAvailability[dutyTeacher.id].add(slotKey);
                    classAvailability[classId].add(slotKey);
                    filledCount++;
                }
            }
        }
    }
  }

  // Sonuçları oluşturma kısmı aynı...
  const teacherSchedules: { [teacherId: string]: Schedule['schedule'] } = {};
  Object.values(classScheduleGrids).forEach(classGrid => {
    Object.entries(classGrid).forEach(([day, periods]) => {
      Object.entries(periods).forEach(([period, slot]) => {
        if (slot && slot.teacherId && !slot.isFixed) {
          if (!teacherSchedules[slot.teacherId]) {
            teacherSchedules[slot.teacherId] = {};
            DAYS.forEach(d => teacherSchedules[slot.teacherId][d] = {});
          }
          teacherSchedules[slot.teacherId][day][period] = { classId: slot.classId, subjectId: slot.subjectId, isFixed: false };
        }
      });
    });
  });
  // ... (gerisi aynı)
  const finalSchedules: Omit<Schedule, 'id' | 'createdAt'>[] = Object.entries(teacherSchedules).map(([teacherId, schedule]) => ({
    teacherId, schedule, updatedAt: new Date(),
  }));

  const allTasks = [...fixedTasks, ...flexibleTasks];
  const unassignedTasks = allTasks.filter(task => !task.placed);
  const unassignedLessonsSummary = new Map<string, { className: string, subjectName: string, teacherName: string, missingHours: number }>();
  
  unassignedTasks.forEach(task => {
    const key = task.mapping.id;
    if (!unassignedLessonsSummary.has(key)) {
        unassignedLessonsSummary.set(key, {
            className: allClasses.find(c => c.id === task.mapping.classId)?.name || 'Bilinmeyen Sınıf',
            subjectName: allSubjects.find(s => s.id === task.mapping.subjectId)?.name || 'Bilinmeyen Ders',
            teacherName: allTeachers.find(t => t.id === task.mapping.teacherId)?.name || 'Bilinmeyen Öğretmen',
            missingHours: 0
        });
    }
    unassignedLessonsSummary.get(key)!.missingHours++;
  });

  const stats = {
    totalLessonsToPlace: allTasks.length,
    placedLessons: allTasks.length - unassignedTasks.length,
    unassignedLessons: Array.from(unassignedLessonsSummary.values())
  };

  const warnings = stats.unassignedLessons.length > 0 ? [`Bazı dersler (${stats.unassignedLessons.length} adet) kısıtlamalar nedeniyle tam olarak yerleştirilemedi.`] : [];

  return {
    success: finalSchedules.length > 0,
    schedules: finalSchedules,
    statistics: stats,
    warnings: warnings,
    errors: [],
  };
}
