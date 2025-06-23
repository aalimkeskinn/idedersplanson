// --- START OF FILE src/utils/subjectTeacherMapping.ts ---

import { Teacher, Class, Subject } from '../types';
import { WizardData, SubjectTeacherMapping } from '../types/wizard';

/**
 * Belirli bir ders ve sınıf için en uygun öğretmeni bulur.
 * Bu fonksiyon, öğretmenin ve dersin çoklu seviye ve branşlarını dikkate alır.
 */
function findSuitableTeacher(subject: Subject, classItem: Class, availableTeachers: Teacher[]): Teacher | null {
  // Sınıfın seviyesi veya seviyeleri
  const classLevels = classItem.levels || [classItem.level];
  // Dersin seviyesi veya seviyeleri
  const subjectLevels = subject.levels || [subject.level];

  // Sınıf ve ders arasında en az bir ortak seviye olmalı
  const hasMatchingLevelContext = classLevels.some(cl => subjectLevels.includes(cl));
  if (!hasMatchingLevelContext) {
    return null; // Bu ders bu sınıfa verilemez.
  }
  
  // Sınıfa atanmış özel öğretmenleri önceliklendir
  const primaryCandidates = availableTeachers.filter(t => 
    classItem.teacherIds?.includes(t.id) || classItem.classTeacherId === t.id
  );

  // Diğer tüm öğretmenler
  const secondaryCandidates = availableTeachers.filter(t => 
    !primaryCandidates.some(pc => pc.id === t.id)
  );

  // Kontrol fonksiyonu
  const isTeacherSuitable = (teacher: Teacher): boolean => {
    const teacherBranches = teacher.branches || [teacher.branch];
    const teacherLevels = teacher.levels || [teacher.level];
    
    // Öğretmenin branşı, dersin branşıyla eşleşiyor mu?
    const matchesBranch = teacherBranches.includes(subject.branch);
    // Öğretmenin seviyelerinden en az biri, dersin seviyelerinden en az biriyle eşleşiyor mu?
    const matchesLevel = teacherLevels.some(tl => subjectLevels.includes(tl));
    
    return matchesBranch && matchesLevel;
  };

  // Önce birincil adayları dene
  const suitablePrimaryTeacher = primaryCandidates.find(isTeacherSuitable);
  if (suitablePrimaryTeacher) return suitablePrimaryTeacher;
  
  // Sonra ikincil adayları dene
  const suitableSecondaryTeacher = secondaryCandidates.find(isTeacherSuitable);
  if (suitableSecondaryTeacher) return suitableSecondaryTeacher;

  return null;
}

/**
 * Sihirbaz verilerini kullanarak ders-öğretmen-sınıf eşleştirmelerini oluşturur.
 * Bu, programlama algoritmasının "görev listesidir".
 */
export function createSubjectTeacherMappings(
  wizardData: WizardData,
  allTeachers: Teacher[],
  allClasses: Class[],
  allSubjects: Subject[]): { mappings: SubjectTeacherMapping[], errors: string[] } {
  const mappings: SubjectTeacherMapping[] = [];
  const errors: string[] = [];

  const selectedClasses = allClasses.filter(c => wizardData.classes.selectedClasses.includes(c.id));
  const selectedSubjects = allSubjects.filter(s => wizardData.subjects.selectedSubjects.includes(s.id));
  const selectedTeachers = allTeachers.filter(t => wizardData.teachers.selectedTeachers.includes(t.id));

  for (const classItem of selectedClasses) {
    for (const subject of selectedSubjects) {
      // Dersin seviyeleri ile sınıfın seviyeleri arasında en az bir ortak nokta olmalı.
      const classLevels = classItem.levels || [classItem.level];
      const subjectLevels = subject.levels || [subject.level];
      const hasLevelOverlap = classLevels.some(cl => subjectLevels.includes(cl));

      if (!hasLevelOverlap) {
        continue; // Seviyeler uyuşmuyorsa bu dersi bu sınıfa atama.
      }

      const suitableTeacher = findSuitableTeacher(subject, classItem, selectedTeachers);

      if (suitableTeacher) {
        mappings.push({
          id: `${classItem.id}-${subject.id}`, // Benzersiz ID
          classId: classItem.id,
          subjectId: subject.id,
          teacherId: suitableTeacher.id,
          weeklyHours: wizardData.subjects.subjectHours[subject.id] || subject.weeklyHours,
          assignedHours: 0,
          priority: wizardData.subjects.subjectPriorities[subject.id] || 'medium',
        });
      } else {
        errors.push(`'${classItem.name}' sınıfı için "${subject.name}" dersine uygun öğretmen bulunamadı.`);
      }
    }
  }
  return { mappings, errors };
}