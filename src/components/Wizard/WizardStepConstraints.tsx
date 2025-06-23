// src/components/Wizard/WizardStepConstraints.tsx

import React, { useState, useEffect } from 'react';
import { Clock, User, Building, BookOpen, Settings, Wand2 } from 'lucide-react';
import { Teacher, Class, Subject, DAYS, PERIODS } from '../../types';
import { WizardData } from '../../types/wizard';
import { TimeConstraint, ConstraintType } from '../../types/constraints';
import Button from '../UI/Button';
import Select from '../UI/Select';
import TimeConstraintGrid from '../Constraints/TimeConstraintGrid';

const RULE_TEMPLATES = [
  { 
    id: 'ilkokul-kulup', 
    label: 'İlkokul Kulüp (Perşembe Son 2 Saat)',
    level: 'İlkokul',
    day: 'Perşembe', 
    periods: ['9', '10'] 
  },
  { 
    id: 'ortaokul-kulup', 
    label: 'Ortaokul Kulüp (Perşembe 7-8. Saat)',
    level: 'Ortaokul',
    day: 'Perşembe', 
    periods: ['7', '8'] 
  },
];

interface WizardStepConstraintsProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
}

const WizardStepConstraints: React.FC<WizardStepConstraintsProps> = ({
  data,
  onUpdate,
  teachers,
  classes,
  subjects
}) => {
  const [activeTab, setActiveTab] = useState<'global' | 'teachers' | 'classes' | 'subjects'>('global');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [localConstraints, setLocalConstraints] = useState<TimeConstraint[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    setLocalConstraints(data.constraints?.timeConstraints || []);
    setHasUnsavedChanges(false);
  }, [data.constraints?.timeConstraints, selectedEntity]);

  useEffect(() => {
    const hasChanges = JSON.stringify(localConstraints) !== JSON.stringify(data.constraints?.timeConstraints || []);
    setHasUnsavedChanges(hasChanges);
  }, [localConstraints, data.constraints?.timeConstraints]);

  // DÜZELTME: getEntityOptions fonksiyonu her sekme için doğru listeyi döndürecek şekilde güncellendi.
  const getEntityOptions = () => {
    switch (activeTab) {
      case 'teachers': 
        return teachers
          .filter(t => data.teachers?.selectedTeachers.includes(t.id))
          .map(t => ({ value: t.id, label: `${t.name} (${t.branch})` }));
      case 'classes': 
        return classes
          .filter(c => data.classes?.selectedClasses.includes(c.id))
          .map(c => ({ value: c.id, label: `${c.name} (${(c.levels || [c.level]).join(', ')})` }));
      case 'subjects': 
        return subjects
          .filter(s => data.subjects?.selectedSubjects.includes(s.id))
          .map(s => ({ value: s.id, label: `${s.name} (${s.branch})` }));
      default: 
        return [];
    }
  };

  const getSelectedEntity = () => {
    if (!selectedEntity) return null;
    switch (activeTab) {
      case 'teachers': return teachers.find(t => t.id === selectedEntity);
      case 'classes': return classes.find(c => c.id === selectedEntity);
      case 'subjects': return subjects.find(s => s.id === selectedEntity);
      default: return null;
    }
  };
  
  const handleApplyRuleTemplate = () => {
    if (!selectedEntity || !selectedTemplateId || activeTab !== 'subjects') return;
    const template = RULE_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const newConstraints: TimeConstraint[] = [];
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        const constraintType: ConstraintType = (day === template.day && template.periods.includes(period)) ? 'preferred' : 'unavailable';
        newConstraints.push({
          id: `${selectedEntity}-${day}-${period}`,
          entityType: 'subject',
          entityId: selectedEntity,
          day, period, constraintType,
          reason: `Kural: ${template.label}`,
          createdAt: new Date(), updatedAt: new Date(),
        });
      });
    });

    const otherEntityConstraints = (data.constraints?.timeConstraints || []).filter(c => c.entityId !== selectedEntity);
    onConstraintsChange([...otherEntityConstraints, ...newConstraints]);
  };

  const onConstraintsChange = (constraints: TimeConstraint[]) => {
    setLocalConstraints(constraints);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    onUpdate({ constraints: { ...(data.constraints || {}), timeConstraints: localConstraints } });
    setHasUnsavedChanges(false);
  };
  
  const handleGlobalConstraintChange = (key: string, value: any) => {
    onUpdate({
      constraints: {
        ...(data.constraints || { timeConstraints: [] }),
        globalRules: {
          ...(data.constraints?.globalRules as object),
          [key]: value
        }
      }
    });
  };

  const currentSelectedEntityObject = getSelectedEntity();
  const entityName = currentSelectedEntityObject?.name || '';
  const entityLevels = (currentSelectedEntityObject as any)?.levels || [(currentSelectedEntityObject as any)?.level];
  const entityLevel = entityLevels[0];
  const availableTemplates = currentSelectedEntityObject ? RULE_TEMPLATES.filter(t => entityLevels.includes(t.level)) : [];
  
  const globalConstraints = data.constraints?.globalRules || {};

  const renderGlobalConstraints = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-900 mb-3">Günlük Limitler</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maksimum Günlük Ders (Öğretmen)</label>
              <input type="number" min="1" max="10" value={globalConstraints.maxDailyHoursTeacher || 8} onChange={(e) => handleGlobalConstraintChange('maxDailyHoursTeacher', parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maksimum Günlük Ders (Sınıf)</label>
              <input type="number" min="1" max="10" value={globalConstraints.maxDailyHoursClass || 9} onChange={(e) => handleGlobalConstraintChange('maxDailyHoursClass', parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-900 mb-3">Ardışık Ders Kuralları</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maksimum Ardışık Ders</label>
              <input type="number" min="1" max="5" value={globalConstraints.maxConsecutiveHours || 3} onChange={(e) => handleGlobalConstraintChange('maxConsecutiveHours', parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
            </div>
            <div className="flex items-center"><input type="checkbox" id="avoidConsecutive" checked={globalConstraints.avoidConsecutiveSameSubject || false} onChange={(e) => handleGlobalConstraintChange('avoidConsecutiveSameSubject', e.target.checked)} className="mr-2" /><label htmlFor="avoidConsecutive" className="text-sm">Aynı dersin ardışık olmasını önle</label></div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'global', label: 'Genel Kurallar', icon: Settings },
    { id: 'teachers', label: 'Öğretmenler', icon: User },
    { id: 'classes', label: 'Sınıflar', icon: Building },
    { id: 'subjects', label: 'Dersler', icon: BookOpen }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Clock className="w-12 h-12 text-purple-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Zaman Kısıtlamaları</h2>
        <p className="text-gray-600">Program oluşturma kurallarını ve zaman kısıtlamalarını belirleyin.</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSelectedEntity(''); }} className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4 mr-2" />{tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="mt-6">
        {activeTab === 'global' && renderGlobalConstraints()}
        {activeTab !== 'global' && (
          <div className="space-y-4">
            <Select
              label={`${activeTab === 'teachers' ? 'Öğretmen' : activeTab === 'classes' ? 'Sınıf' : 'Ders'} Seçin`}
              value={selectedEntity}
              onChange={(value) => { setSelectedEntity(value); setSelectedTemplateId(''); }}
              options={[{ value: '', label: 'Seçim yapın...' }, ...getEntityOptions()]}
            />

            {selectedEntity && currentSelectedEntityObject ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {activeTab === 'subjects' && (
                  <div className="p-4 bg-gray-50 border-b">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center"><Wand2 className="w-4 h-4 mr-2 text-orange-500"/>Kural Şablonu Uygula</h4>
                    {availableTemplates.length > 0 ? (
                      <div className="flex items-end gap-2">
                        <div className="flex-grow">
                          <Select 
                            label="Uygulanacak Kural"
                            value={selectedTemplateId}
                            onChange={setSelectedTemplateId}
                            options={[{value: '', label: 'Şablon Seçin...'}, ...availableTemplates.map(t => ({ value: t.id, label: t.label }))]}
                          />
                        </div>
                        <Button onClick={handleApplyRuleTemplate} disabled={!selectedTemplateId} variant="primary">Uygula</Button>
                      </div>
                    ) : <p className="text-sm text-gray-500">Bu dersin seviyelerine uygun kural şablonu bulunmuyor.</p>}
                    <p className="text-xs text-gray-500 mt-1">Bu işlem, bu dersin tüm kısıtlamalarını sıfırlayıp şablonu uygular.</p>
                  </div>
                )}
                
                <TimeConstraintGrid
                  entityType={activeTab.slice(0, -1) as any}
                  entityId={selectedEntity}
                  entityName={entityName}
                  entityLevel={entityLevel}
                  constraints={localConstraints}
                  onConstraintsChange={onConstraintsChange}
                  onSave={handleSave}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      {React.createElement(tabs.find(t=>t.id === activeTab)?.icon || Clock, {className:"w-8 h-8 text-gray-400"})}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Öğe Seçin</h3>
                  <p className="text-gray-500 max-w-md mx-auto">Zaman kısıtlamalarını düzenlemek için yukarıdaki listeden bir {activeTab.slice(0,-1)} seçin.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WizardStepConstraints;