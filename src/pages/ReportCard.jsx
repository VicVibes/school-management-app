import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { supabase } from '../supabaseClient'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  row: { flexDirection: 'row', borderBottom: '1px solid #ccc', paddingVertical: 4 },
  cell: { flex: 1 },
})

function ReportCardDoc({ student, results, ranking }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Report Card</Text>
        <Text>Name: {student.full_name}</Text>
        <Text>Class Position: {ranking?.class_position || '-'} of {ranking?.class_size || '-'}</Text>
        <Text>Grand Total: {ranking?.grand_total || 0}</Text>
        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text style={styles.cell}>Subject</Text>
            <Text style={styles.cell}>CA1</Text>
            <Text style={styles.cell}>CA2</Text>
            <Text style={styles.cell}>CA3</Text>
            <Text style={styles.cell}>Exam</Text>
            <Text style={styles.cell}>Total</Text>
          </View>
          {results.map((r) => (
            <View style={styles.row} key={r.id}>
              <Text style={styles.cell}>{r.subjects?.subject_name}</Text>
              <Text style={styles.cell}>{r.ca1}</Text>
              <Text style={styles.cell}>{r.ca2}</Text>
              <Text style={styles.cell}>{r.ca3}</Text>
              <Text style={styles.cell}>{r.exam}</Text>
              <Text style={styles.cell}>{r.total}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export default function ReportCard() {
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [results, setResults] = useState([])
  const [ranking, setRanking] = useState(null)

  useEffect(() => { load() }, [studentId])

  async function load() {
    const { data: studentData } = await supabase.from('students').select('*').eq('id', studentId).single()
    const { data: resultData } = await supabase.from('results').select('*, subjects(subject_name)').eq('student_id', studentId)
    const { data: rankData } = await supabase.from('class_rankings').select('*').eq('student_id', studentId).single()
    setStudent(studentData)
    setResults(resultData || [])
    setRanking(rankData)
  }

  if (!student) return <p style={{ padding: 40 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h2>{student.full_name}'s Report Card</h2>
      <PDFDownloadLink
        document={<ReportCardDoc student={student} results={results} ranking={ranking} />}
        fileName={`${student.full_name}-report-card.pdf`}
      >
        {({ loading }) => (
          <button style={{ padding: '10px 20px' }}>{loading ? 'Preparing PDF...' : 'Download Report Card PDF'}</button>
        )}
      </PDFDownloadLink>
    </div>
  )
}