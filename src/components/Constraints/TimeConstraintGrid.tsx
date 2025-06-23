import React, { useState } from 'react';
import { Clock, Save, RotateCcw, Info, CheckCircle, AlertTriangle, XCircle, Slash, Lock } from 'lucide-react';
import { DAYS, PERIODS, getTimeForPeriod, formatTimeRange } from '../../types';
import { TimeConstraint, CONSTRAINT_TYPES, ConstraintType } from '../../types/constraints';
import Button from '../UI/Button';

interface TimeConstraintGridProps {
  entityType: 'teacher' | 'class' | 'subject';
  entityId: string;
  entityName: string;
  entityLevel?: 'Anaokulu' | 'İlkokul' | 'Ortaokul';
  constraints: TimeConstraint[];
  onConstraintsChange: (constraints: TimeConstraint[]) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
}

const TimeConstraintGrid: React.FC<TimeConstraintGridProps> = ({
  entityType,
  entityId,
  entityName,
  entityLevel,
  constraints,
  onConstraintsChange,
  onSave,
  hasUnsavedChanges
}) => {
  const [selectedConstraintType, setSelectedConstraintType] = useState<ConstraintType>('unavailable');
  
  // DÜZENLENDİ: Tüm periyotları ve sabit molaları içerecek şekilde güncellendi
  // Bu dizi, tablonun satırlarını oluşturmak için kullanılacak
  const ALL_RENDERED_PERIODS = [
      'prep', '1', '2', '3', '4', 
      '5', // Bu hem ders hem de ilkokul yemeği olabilir
      '6', // Bu hem ders hem de ortaokul yemeği olabilir
      '7', '8', 
      'afternoon-breakfast', // Bu her zaman ikindi kahvaltısı
      '9', '10'
  ];
  
  // Seviyeye göre sabit olan periyodun adını ve saatini döndürür
  const getFixedPeriodInfoForPeriod = (period: string) => {
    const level = entityLevel || 'İlkokul'; // Eğer seviye belirsizse varsayılan
    
    if (period === 'prep') return { name: 'Hazırlık', time: '08:30 - 08:50' };
    if (period === 'afternoon-breakfast') return { name: 'İkindi K.', time: '14:35 - 14:45' };
    if (period === '5' && (level === 'İlkokul' || level === 'Anaokulu')) return { name: 'Yemek', time: '11:50 - 12:25' };
    if (period === '6' && level === 'Ortaokul') return { name: 'Yemek', time: '12:30 - 13:05' };
    
    // Ortaokul kahvaltısı için özel durum
    const timeFor2ndPeriod = getTimeForPeriod('2', level);
    if(timeFor2ndPeriod && period === 'break-after-1'){
        return { name: 'Kahvaltı', time: '09:15 - 09:35'}
    }

    return null;
  };

  const setAllSlotsTo = (type: ConstraintType) => {
    const newConstraints: TimeConstraint[] = [];
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        // Sabit periyotları atla
        if (getFixedPeriodInfoForPeriod(period)) return;

        newConstraints.push({
          id: `${entityId}-${day}-${period}-${Date.now()}`,
          entityType, entityId, day, period,
          constraintType: type,
          reason: `Toplu atama: ${CONSTRAINT_TYPES[type].label}`,
          createdAt: new Date(), updatedAt: new Date()
        });
      });
    });
    const otherEntityConstraints = constraints.filter(c => c.entityId !== entityId);
    onConstraintsChange([...otherEntityConstraints, ...newConstraints]);
  };

  const handleSlotClick = (day: string, period: string) => {
    if (getFixedPeriodInfoForPeriod(period)) return;

    const existingConstraintIndex = constraints.findIndex(c => c.entityId === entityId && c.day === day && c.period === period);
    let updatedConstraints = [...constraints];

    if (existingConstraintIndex !== -1) {
      const currentConstraint = updatedConstraints[existingConstraintIndex];
      const newType = currentConstraint.constraintType === selectedConstraintType ? 'preferred' : selectedConstraintType;
      updatedConstraints[existingConstraintIndex] = { ...currentConstraint, constraintType: newType, updatedAt: new Date() };
    } else {
      const newConstraint: TimeConstraint = {
        id: `${entityId}-${day}-${period}-${Date.now()}`,
        entityType, entityId, day, period,
        constraintType: selectedConstraintType,
        reason: `${CONSTRAINT_TYPES[selectedConstraintType].label} - ${entityName}`,
        createdAt: new Date(), updatedAt: new Date()
      };
      updatedConstraints.push(newConstraint);
    }
    onConstraintsChange(updatedConstraints);
  };
  
  const getConstraintForSlot = (day: string, period: string): TimeConstraint | undefined => {
    return constraints.find(c => c.entityId === entityId && c.day === day && c.period === period);
  };
  
  const getTimeInfo = (period: string) => {
    const timePeriod = getTimeForPeriod(period, entityLevel);
    return timePeriod ? formatTimeRange(timePeriod.startTime, timePeriod.endTime) : `${period}. Ders`;
  };

  const getConstraintCount = (type: ConstraintType) => {
    return constraints.filter(c => c.entityId === entityId && c.constraintType === type).length;
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{entityName} - Zaman Kısıtlamaları</h3>
            <p className="text-sm text-gray-600 mt-1">Zaman dilimlerine tıklayarak kısıtlama türünü değiştirin.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={() => setAllSlotsTo('unavailable')} icon={Slash} variant="danger" size="sm" title="Tüm saatleri 'Müsait Değil' yap">Tümünü Meşgul Yap</Button>
            <Button onClick={() => setAllSlotsTo('preferred')} icon={RotateCcw} variant="secondary" size="sm" title="Tüm saatleri 'Tercih Edilen' yap">Sıfırla</Button>
            <Button onClick={onSave} icon={Save} variant="primary" size="sm" disabled={!hasUnsavedChanges}>Kaydet</Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* ... Seçim ve bilgilendirme kutuları ... */}
      </div>

      <div className="border-t border-gray-200">
        <div className="table-responsive">
          <table className="min-w-full">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Ders Saati</th>{DAYS.map(day => (<th key={day} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"><div className="font-bold">{day}</div></th>))}</tr></thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {ALL_RENDERED_PERIODS.map((period, index) => {
                  if (period === '6' && (entityLevel === 'İlkokul' || entityLevel === 'Anaokulu')) return null; // İlkokulda 6. ders yok (yemekten sonra)
                  if (period === '5' && entityLevel === 'Ortaokul' && getFixedPeriodInfoForPeriod('6')) return null; // Ortaokulda 5. dersten sonra yemek varsa 5'i göster ama yemeği 6'da göster
                  
                  const fixedPeriodInfo = getFixedPeriodInfoForPeriod(period);
                  const isMiddleSchoolBreakAfter1 = entityLevel === 'Ortaokul' && period === '1';

                  const renderRow = (p: string, isBreakRow = false) => {
                    const currentFixedInfo = getFixedPeriodInfoForPeriod(p);
                    const timeInfo = currentFixedInfo ? currentFixedInfo.time : getTimeInfo(p);
                    const periodLabel = currentFixedInfo ? currentFixedInfo.name : `${p}. Ders`;
                    
                    return (
                      <tr key={p} className={currentFixedInfo ? 'bg-green-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                        <td className={`px-4 py-3 font-medium text-gray-900 sticky left-0 z-10 border-r ${currentFixedInfo ? 'bg-green-100' : 'bg-gray-50'}`}>
                          <div className="text-center"><div className="font-bold text-sm">{periodLabel}</div><div className="text-xs text-gray-600 mt-1 flex items-center justify-center"><Clock className="w-3 h-3 mr-1" />{timeInfo}</div></div>
                        </td>
                        {DAYS.map(day => {
                          if (currentFixedInfo) {
                            return (<td key={`${day}-${p}`} className="px-2 py-2"><div className="w-full min-h-[70px] p-3 rounded-lg border-2 border-green-200 bg-green-100 flex flex-col items-center justify-center text-green-800"><Lock size={18} className="mb-1"/><div className="text-xs font-medium leading-tight">{currentFixedInfo.name}</div></div></td>);
                          }
                          const constraint = getConstraintForSlot(day, p);
                          const constraintConfig = constraint ? CONSTRAINT_TYPES[constraint.constraintType] : CONSTRAINT_TYPES.preferred;
                          return (<td key={`${day}-${p}`} className="px-2 py-2"><button onClick={() => handleSlotClick(day, p)} className={`w-full min-h-[70px] p-3 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${constraintConfig.color} hover:opacity-80 hover:scale-105`}><div className="text-center"><div className="text-xl mb-1">{constraintConfig.icon}</div><div className="text-xs font-medium leading-tight">{constraintConfig.label}</div></div></button></td>);
                        })}
                      </tr>
                    )
                  }
                  
                  return (
                    <React.Fragment key={period}>
                      {renderRow(period)}
                      {isMiddleSchoolBreakAfter1 && renderRow('break-after-1', true)}
                    </React.Fragment>
                  )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TimeConstraintGrid;