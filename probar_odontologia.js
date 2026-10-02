async function probarOdontologia() {
  const BASE_URL = 'http://127.0.0.1:3000/api/odontologia';
  console.log('=== BATERÍA DE PRUEBAS: ODONTOLOGÍA Y ODONTOGRAMA (CLINIX) ===\n');

  try {
    // 1. Probar Plantilla de Dentición Adulta
    const resAdulto = await fetch(`${BASE_URL}/plantilla`);
    const plantillaAdulto = await resAdulto.json();
    console.log('[1/4] Plantilla Adulta (FDI):');
    console.log('   Total piezas generadas:', plantillaAdulto.total_piezas);
    console.log('   Primer diente:', plantillaAdulto.odontograma[0].numero_fdi, '| Último diente:', plantillaAdulto.odontograma[plantillaAdulto.odontograma.length - 1].numero_fdi);
    
    if (plantillaAdulto.total_piezas !== 32) {
      throw new Error(`Se esperaban 32 piezas para adulto, se recibieron: ${plantillaAdulto.total_piezas}`);
    }
    console.log('   -> OK\n');

    // 2. Probar Plantilla de Dentición Infantil
    const resInfantil = await fetch(`${BASE_URL}/plantilla/INFANTIL`);
    const plantillaInfantil = await resInfantil.json();
    console.log('[2/4] Plantilla Infantil (FDI):');
    console.log('   Total piezas generadas:', plantillaInfantil.total_piezas);
    console.log('   Primer diente:', plantillaInfantil.odontograma[0].numero_fdi, '| Último diente:', plantillaInfantil.odontograma[plantillaInfantil.odontograma.length - 1].numero_fdi);
    
    if (plantillaInfantil.total_piezas !== 20) {
      throw new Error(`Se esperaban 20 piezas para infantil, se recibieron: ${plantillaInfantil.total_piezas}`);
    }
    console.log('   -> OK\n');

    // 3. Probar cálculo de índice epidemiológico CPO-D
    console.log('[3/4] Modificando plantilla con patologías para calcular CPO-D...');
    const odontogramaPrueba = JSON.parse(JSON.stringify(plantillaAdulto.odontograma));

    // Hallazgos:
    // Diente 18 (index 0): Caries en cara oclusal (C = 1)
    odontogramaPrueba[0].cara_oclusal = 'CARIES';
    // Diente 16 (index 2): Resina en cara mesial (O = 1)
    odontogramaPrueba[2].cara_mesial = 'RESINA';
    // Diente 24 (index 11): Ausente (P = 1)
    odontogramaPrueba[11].estado_general = 'AUSENTE';
    // Diente 46 (index 18): Extracción (P = 2)
    odontogramaPrueba[18].estado_general = 'EXTRACCION';
    // Diente 36 (index 29): Caries en cara vestibular (C = 2)
    odontogramaPrueba[29].cara_vestibular = 'CARIES';

    const resCalculo = await fetch(`${BASE_URL}/calcular-indice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_denticion: 'ADULTA',
        piezas: odontogramaPrueba
      })
    });

    const resultadoCpod = await resCalculo.json();
    console.log('   Resultado CPO-D obtenido:', resultadoCpod.indice_cpod);
    console.log('   Desglose:', resultadoCpod.desglose);

    if (resultadoCpod.indice_cpod !== 5) {
      throw new Error(`Cálculo de CPO-D incorrecto. Esperado 5, obtenido: ${resultadoCpod.indice_cpod}`);
    }
    console.log('   -> OK (2 Cariados + 2 Perdidos + 1 Obturado = 5)\n');

    // 4. Verificación de conectividad a través del proxy Traefik (Puerto 80)
    console.log('[4/4] Verificando proxy Traefik (Puerto 80)...');
    const resTraefik = await fetch('http://127.0.0.1/api/odontologia/plantilla');
    if (resTraefik.ok) {
      console.log('   Ruta /api accesible a través de Traefik -> OK\n');
    }

    console.log('=== MÓDULO DE ODONTOLOGÍA Y ODONTOGRAMA VERIFICADO CON ÉXITO ===');
  } catch (error) {
    console.error('\n[ERROR DURANTE LAS PRUEBAS]:', error.message);
  }
}

probarOdontologia();
